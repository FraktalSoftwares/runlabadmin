import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { fetchBrlPerCredit } from "@/lib/creditToBrl";

export interface OverviewMetrics {
  faturamento: number;
  inscricoesPagas: number;
  inscricoesEmAberto: number;
  numeroAssinantes: number;
  margemBruta: number;
  comissaoParceiros: number;
}

export interface PieDataItem {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyBarItem {
  month: string;
  value: number;
  monthIndex: number;
}

const RECEIPT_COLORS: Record<string, string> = {
  Inscrição: "#CCF725",
  Assinatura: "#E8F5A0",
  Avulso: "#B3D91F",
};

const PARTNER_COLORS: Record<string, string> = {
  Academia: "#CCF725",
  Treinador: "#8B9D00",
  Assessoria: "#E8F5A0",
};

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function periodBounds(year: number, month: number) {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchOverviewData(year: number, month: number) {
  const { start, end } = periodBounds(year, month);

  // ── 1) runner_payments confirmados no período ────────────────────
  const { data: payments, error: paymentsError } = await supabase
    .from("runner_payments")
    .select("id, amount, plan_type, status, paid_at, user_id")
    .in("status", ["CONFIRMED", "RECEIVED"])
    .not("paid_at", "is", null)
    .gte("paid_at", start)
    .lte("paid_at", end);

  if (paymentsError) throw paymentsError;

  const paymentsList = payments ?? [];
  const faturamentoPlanos = paymentsList.reduce((acc, p) => acc + Number(p.amount), 0);

  const assinantesSet = new Set(
    paymentsList.filter((p) => p.plan_type === "anual").map((p) => p.user_id),
  );

  const byPlanType: Record<string, number> = { anual: 0, avulsa: 0 };
  paymentsList.forEach((p) => {
    byPlanType[p.plan_type] = (byPlanType[p.plan_type] ?? 0) + Number(p.amount);
  });

  // ── 2) credit_transactions de tipo "usage" no período ───────────
  //    (créditos consumidos em competições nesse mês)
  const [brlPerCredit, usageResult] = await Promise.all([
    fetchBrlPerCredit(),
    supabase
      .from("credit_transactions")
      .select("amount, competition_registration_id")
      .eq("type", "usage")
      .not("competition_registration_id", "is", null)
      .gte("created_at", start)
      .lte("created_at", end),
  ]);

  const usages = usageResult.data ?? [];
  const totalCreditsUsed = usages.reduce((acc, u) => acc + Math.abs(u.amount), 0);
  const faturamentoCreditos = Math.round(totalCreditsUsed * brlPerCredit * 100) / 100;

  const faturamentoTotal = faturamentoPlanos + faturamentoCreditos;

  // ── 3) Inscrições no período ─────────────────────────────────────
  const { data: regs, error: regsError } = await supabase
    .from("competition_registrations")
    .select("id, status, created_at")
    .gte("created_at", start)
    .lte("created_at", end)
    .neq("status", "cancelled");

  if (regsError) throw regsError;

  const regsList = regs ?? [];
  const inscricoesPagas = regsList.filter((r) => r.status === "confirmed").length;
  const inscricoesEmAberto = regsList.filter((r) => r.status === "pending").length;

  // ── 4) Gráfico de pizza: receita por tipo ────────────────────────
  const totalReceita = faturamentoTotal || 1;
  const receiptPie: PieDataItem[] = [];

  if (faturamentoCreditos > 0) {
    receiptPie.push({
      name: "Inscrição",
      value: Math.round((faturamentoCreditos / totalReceita) * 100),
      color: RECEIPT_COLORS.Inscrição,
    });
  }
  if (byPlanType.anual > 0) {
    receiptPie.push({
      name: "Assinatura",
      value: Math.round((byPlanType.anual / totalReceita) * 100),
      color: RECEIPT_COLORS.Assinatura,
    });
  }
  if (byPlanType.avulsa > 0) {
    receiptPie.push({
      name: "Avulso",
      value: Math.round((byPlanType.avulsa / totalReceita) * 100),
      color: RECEIPT_COLORS.Avulso,
    });
  }
  if (receiptPie.length === 0) {
    receiptPie.push({ name: "Nenhuma receita", value: 100, color: "#666" });
  }

  // ── 5) Gráfico de pizza: parceiros ───────────────────────────────
  const { data: partners } = await supabase
    .from("profiles")
    .select("id")
    .eq("tipo_user", "Parceiro");

  const totalParceiros = partners?.length ?? 0;
  const partnerPie: PieDataItem[] =
    totalParceiros > 0
      ? [
          { name: "Academia", value: 34, color: PARTNER_COLORS.Academia },
          { name: "Treinador", value: 33, color: PARTNER_COLORS.Treinador },
          { name: "Assessoria", value: 33, color: PARTNER_COLORS.Assessoria },
        ]
      : [{ name: "Sem dados de parceiros", value: 100, color: "#666" }];

  // ── 6) Margem e comissão ─────────────────────────────────────────
  const comissaoParceiros = Math.round(faturamentoTotal * 0.06 * 100) / 100;
  const margemBruta = Math.round((faturamentoTotal - comissaoParceiros) * 100) / 100;

  const metrics: OverviewMetrics = {
    faturamento: Math.round(faturamentoTotal * 100) / 100,
    inscricoesPagas,
    inscricoesEmAberto,
    numeroAssinantes: assinantesSet.size,
    margemBruta,
    comissaoParceiros,
  };

  // ── 7) Gráfico de barras: inscrições por mês (ano inteiro) ──────
  const yearStart = new Date(year, 0, 1).toISOString();
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();

  const { data: regsYear } = await supabase
    .from("competition_registrations")
    .select("id, created_at")
    .gte("created_at", yearStart)
    .lte("created_at", yearEnd)
    .neq("status", "cancelled");

  const byMonth = new Array(12).fill(0);
  (regsYear ?? []).forEach((r) => {
    const d = new Date(r.created_at);
    if (d.getFullYear() === year) {
      byMonth[d.getMonth()]++;
    }
  });

  const monthlyData: MonthlyBarItem[] = MONTH_LABELS.map((label, i) => ({
    month: label,
    value: byMonth[i],
    monthIndex: i,
  }));

  return { metrics, receiptData: receiptPie, partnerData: partnerPie, monthlyData };
}

export function useFinanceiroOverview(year: number, month: number) {
  return useQuery({
    queryKey: ["financeiro-overview", year, month],
    queryFn: () => fetchOverviewData(year, month),
  });
}
