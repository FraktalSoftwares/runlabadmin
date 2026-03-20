import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  fetchBrlPerCredit,
  fetchCreditUsageByCompetition,
} from "@/lib/creditToBrl";
import { useRealtimeInvalidation } from "./useSupabaseRealtime";

export type FinanceiroCompetitionStatus = "aberta" | "em_andamento" | "finalizada" | "rascunho";

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
    case "closed":
      return "finalizada";
    default:
      return "rascunho";
  }
}

function formatEtapa(startsAt: string | null): string {
  if (!startsAt) return "-";
  const d = new Date(startsAt);
  const month = d.toLocaleString("pt-BR", { month: "long" });
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${d.getFullYear()}`;
}

async function fetchFinanceiroCompeticoes(
  search?: string,
): Promise<FinanceiroCompetitionRow[]> {
  let query = supabase
    .from("competitions")
    .select("id, title, status, starts_at, is_free, created_at")
    .order("created_at", { ascending: false });

  if (search?.trim()) {
    query = query.ilike("title", `%${search.trim()}%`);
  }

  const [compResult, brlPerCredit, creditUsage] = await Promise.all([
    query,
    fetchBrlPerCredit(),
    fetchCreditUsageByCompetition(),
  ]);

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

  const { usageByCompetition } = creditUsage;

  return competitions.map((c) => {
    const creditsUsed = usageByCompetition[c.id] ?? 0;
    const receita = Math.round(creditsUsed * brlPerCredit * 100) / 100;
    const comissao = Math.round(receita * 0.06 * 100) / 100;
    const margem = Math.round((receita - comissao) * 100) / 100;

    return {
      id: c.id,
      numericId: c.id.slice(0, 7).replace(/-/g, ""),
      nome: c.title ?? "-",
      etapaVinculada: formatEtapa(c.starts_at),
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
    ["competitions", "competition_registrations", "credit_transactions"],
    [["financeiro-competicoes"]],
  );

  return useQuery({
    queryKey: ["financeiro-competicoes", search],
    queryFn: () => fetchFinanceiroCompeticoes(search),
  });
}
