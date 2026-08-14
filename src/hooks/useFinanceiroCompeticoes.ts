import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useRealtimeInvalidation } from "./useSupabaseRealtime";
import { formatLocalDate, resolveLocalDate } from "@/lib/localDate";

export type FinanceiroCompetitionStatus = "aberta" | "em_andamento" | "fechada" | "finalizada" | "rascunho";

export interface FinanceiroCompetitionRow {
  id: string;
  numericId: string;
  nome: string;
  etapaVinculada: string;
  inscricoes: number;
  margemBruta: number;
  receitaTotal: number;
  comissaoParceiros: number;
  status: FinanceiroCompetitionStatus;
}

type DbStatus = "draft" | "open" | "closed" | "in_progress" | "finished";

function mapStatus(status: DbStatus | null): FinanceiroCompetitionStatus {
  switch (status) {
    case "open":
      return "aberta";
    case "in_progress":
      return "em_andamento";
    case "finished":
      return "finalizada";
    case "closed":
      return "fechada";
    default:
      return "rascunho";
  }
}

function formatEtapa(startsOn: string | null): string {
  if (!startsOn) return "-";
  return formatLocalDate(startsOn, { month: "long", year: "numeric" })
    .replace(/^./, (value) => value.toUpperCase());
}

async function fetchFinanceiroCompeticoes(
  search?: string,
): Promise<FinanceiroCompetitionRow[]> {
  let query = supabase
    .from("competitions")
    .select("id, title, status, starts_on, starts_at, is_free, created_at")
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const compResult = await query;
  if (compResult.error) throw compResult.error;
  const competitions = compResult.data ?? [];
  if (!competitions.length) return [];

  const ids = competitions.map((c) => c.id);

  // Inscrições por competição (não canceladas)
  const { data: regs } = await supabase
    .from("competition_registrations")
    .select("id, competition_id, status")
    .in("competition_id", ids)
    .neq("status", "cancelled");

  const countByComp: Record<string, number> = {};
  (regs ?? []).forEach((r) => {
    countByComp[r.competition_id] = (countByComp[r.competition_id] ?? 0) + 1;
  });

  // Receita por competição (cash basis): runner_payments confirmados com
  // competition_id apontando para a competição.
  const { data: paymentsByComp } = await supabase
    .from("runner_payments")
    .select("id, amount, competition_id")
    .in("status", ["CONFIRMED", "RECEIVED"])
    .not("paid_at", "is", null)
    .in("competition_id", ids);

  const receitaByComp: Record<string, number> = {};
  const paymentIdsByComp: Record<string, string[]> = {};
  (paymentsByComp ?? []).forEach((p) => {
    if (!p.competition_id) return;
    receitaByComp[p.competition_id] = (receitaByComp[p.competition_id] ?? 0) + Number(p.amount);
    (paymentIdsByComp[p.competition_id] ??= []).push(p.id);
  });

  // Comissão de parceiros por competição: somar partner_commissions vinculadas
  // aos pagamentos da competição.
  const allPaymentIds = Object.values(paymentIdsByComp).flat();
  const commissionByPaymentId: Record<string, number> = {};
  if (allPaymentIds.length > 0) {
    const { data: commissions } = await supabase
      .from("partner_commissions")
      .select("payment_id, commission_amount")
      .in("payment_id", allPaymentIds);
    (commissions ?? []).forEach((c) => {
      if (!c.payment_id) return;
      commissionByPaymentId[c.payment_id] =
        (commissionByPaymentId[c.payment_id] ?? 0) + Number(c.commission_amount);
    });
  }

  return competitions.map((c) => {
    const receita = Math.round((receitaByComp[c.id] ?? 0) * 100) / 100;
    const compPaymentIds = paymentIdsByComp[c.id] ?? [];
    const comissao = Math.round(
      compPaymentIds.reduce((acc, pid) => acc + (commissionByPaymentId[pid] ?? 0), 0) * 100,
    ) / 100;
    const margem = Math.round((receita - comissao) * 100) / 100;

    return {
      id: c.id,
      numericId: c.id.slice(0, 7).replace(/-/g, ""),
      nome: c.title ?? "-",
      etapaVinculada: formatEtapa(resolveLocalDate(c.starts_on, c.starts_at)),
      inscricoes: countByComp[c.id] ?? 0,
      margemBruta: margem,
      receitaTotal: receita,
      comissaoParceiros: comissao,
      status: mapStatus(c.status as DbStatus),
    };
  });
}

export function useFinanceiroCompeticoes(search?: string) {
  useRealtimeInvalidation(
    [
      "competitions",
      "competition_registrations",
      "runner_payments",
      "partner_commissions",
    ],
    [["financeiro-competicoes"]],
  );

  return useQuery({
    queryKey: ["financeiro-competicoes", search],
    queryFn: () => fetchFinanceiroCompeticoes(search),
  });
}
