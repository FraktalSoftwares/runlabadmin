import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRealtimeInvalidation } from "./useSupabaseRealtime";

export type RecebimentoStatus = "pago" | "em_aberto" | "vencido" | "reembolsado" | "cancelado";

export interface RecebimentoRow {
  id: string;
  shortId: string;
  nome: string;
  tipoRecebimento: string;
  competicao: string;
  valor: number;
  data: string;
  pagamento: string;
  status: RecebimentoStatus;
}

const BILLING_LABELS: Record<string, string> = {
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  PIX: "Pix",
  BOLETO: "Boleto",
};

function mapStatus(dbStatus: string): RecebimentoStatus {
  switch (dbStatus) {
    case "CONFIRMED":
    case "RECEIVED":
      return "pago";
    case "PENDING":
      return "em_aberto";
    case "OVERDUE":
      return "vencido";
    case "REFUNDED":
      return "reembolsado";
    case "CANCELLED":
    case "FAILED":
      return "cancelado";
    default:
      return "em_aberto";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

async function fetchRecebimentos(search?: string): Promise<RecebimentoRow[]> {
  // 1) runner_payments (excluindo FAILED e CANCELLED)
  const { data: payments, error } = await supabase
    .from("runner_payments")
    .select("id, user_id, plan_type, billing_type, amount, status, paid_at, created_at, description")
    .not("status", "in", "(FAILED,CANCELLED)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!payments?.length) return [];

  // 2) Nomes dos usuários
  const userIds = [...new Set(payments.map((p) => p.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const nameMap: Record<string, string> = {};
  (profiles ?? []).forEach((p) => {
    nameMap[p.id] = p.full_name ?? "Usuário";
  });

  // 3) Vincular pagamento → competição via credit_transactions
  //    runner_payments.id → credit_transactions (type=purchase, payment_id)
  //    → mesmo user_id → credit_transactions (type=usage, competition_registration_id)
  //    → competition_registrations → competitions.title
  const paymentIds = payments.map((p) => p.id);

  const { data: purchaseCts } = await supabase
    .from("credit_transactions")
    .select("payment_id, user_id")
    .eq("type", "purchase")
    .in("payment_id", paymentIds);

  // Para cada user que teve purchase, buscar o usage mais recente
  const usersWithPurchase = [...new Set((purchaseCts ?? []).map((ct) => ct.user_id))];

  const compNameByPayment: Record<string, string> = {};

  if (usersWithPurchase.length > 0) {
    const { data: usageCts } = await supabase
      .from("credit_transactions")
      .select("user_id, competition_registration_id")
      .eq("type", "usage")
      .not("competition_registration_id", "is", null)
      .in("user_id", usersWithPurchase);

    if (usageCts?.length) {
      const regIds = [...new Set(usageCts.map((u) => u.competition_registration_id!))];

      const { data: regs } = await supabase
        .from("competition_registrations")
        .select("id, competition_id, user_id")
        .in("id", regIds);

      const compIds = [...new Set((regs ?? []).map((r) => r.competition_id))];
      const { data: comps } = await supabase
        .from("competitions")
        .select("id, title")
        .in("id", compIds);

      const compTitleMap: Record<string, string> = {};
      (comps ?? []).forEach((c) => {
        compTitleMap[c.id] = c.title;
      });

      // user → competição mais recente usada
      const userCompMap: Record<string, string> = {};
      (regs ?? []).forEach((r) => {
        if (!userCompMap[r.user_id] && compTitleMap[r.competition_id]) {
          userCompMap[r.user_id] = compTitleMap[r.competition_id];
        }
      });

      // payment → competição (via user_id do purchase)
      (purchaseCts ?? []).forEach((ct) => {
        if (ct.payment_id && userCompMap[ct.user_id]) {
          compNameByPayment[ct.payment_id] = userCompMap[ct.user_id];
        }
      });
    }
  }

  // 4) Montar rows + ordenar pela data exibida (paid_at quando houver,
  //    senão created_at). A query veio por created_at mas o display usa
  //    paid_at quando disponível — sem este reorder a lista parece bagunçada.
  const rowsWithDate = payments.map((p) => {
    const tipoRecebimento = p.plan_type === "anual" ? "Assinatura" : "Inscrição";
    const competicao = compNameByPayment[p.id] ?? (p.description || "-");
    const sortDate = p.paid_at ?? p.created_at;

    return {
      row: {
        id: p.id,
        shortId: p.id.slice(0, 7).replace(/-/g, ""),
        nome: nameMap[p.user_id] ?? "Usuário",
        tipoRecebimento,
        competicao: tipoRecebimento === "Assinatura" ? "-" : competicao,
        valor: Number(p.amount),
        data: formatDate(sortDate),
        pagamento: BILLING_LABELS[p.billing_type] ?? p.billing_type,
        status: mapStatus(p.status),
      } as RecebimentoRow,
      sortKey: sortDate ? new Date(sortDate).getTime() : 0,
    };
  });

  rowsWithDate.sort((a, b) => b.sortKey - a.sortKey);
  const rows: RecebimentoRow[] = rowsWithDate.map((x) => x.row);

  // 5) Filtro de busca (nome ou competição)
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.competicao.toLowerCase().includes(q) ||
        r.tipoRecebimento.toLowerCase().includes(q),
    );
  }

  return rows;
}

export function useRecebimentos(search?: string) {
  useRealtimeInvalidation(
    ["runner_payments", "credit_transactions"],
    [["financeiro-recebimentos"]],
  );

  return useQuery({
    queryKey: ["financeiro-recebimentos", search],
    queryFn: () => fetchRecebimentos(search),
  });
}
