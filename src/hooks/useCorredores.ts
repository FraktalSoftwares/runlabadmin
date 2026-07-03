import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

export type CorredorFilters = {
  search?: string;
  /** "Corredor" | "Parceiro" - empty = ambos */
  tipoUser?: "Corredor" | "Parceiro";
  /** Parceiro: só quem é parceiro; Corredor: só quem não é; undefined = ambos */
  eParceiro?: boolean;
  naoEParceiro?: boolean;
  /** preferred_distance no perfil */
  preferredDistance?: string;
  /** Mínimo de inscrições em competições (0 = nenhuma, 1+ = mínimo) */
  participacaoMin?: number;
  /** Plano: Gratuito (0 créditos) ou Com créditos (1+) */
  plano?: "Gratuito" | "ComCreditos";
  /** Cidade (ilike) - exige coluna city na view */
  cidade?: string;
  /** Estado (ilike) - exige coluna state na view */
  estado?: string;
};

export type CorredorRow = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  preferencia: string;
  vinculo: string;
  ultimoAcesso: string;
  plano: string;
};

const PAGE_SIZE_DEFAULT = 10;

function formatLastAccess(updatedAt: string | null): string {
  if (!updatedAt) return "—";
  const d = new Date(updatedAt);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }) + " • " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function preferredDistanceToLabel(preferred: string | null): string {
  if (!preferred) return "—";
  if (preferred === "indoor") return "Corrida indoor";
  if (preferred === "outdoor") return "Corrida outdoor";
  return preferred;
}

/** Busca corredores (view v_corredores_admin) com filtros e paginação */
async function fetchCorredores(
  filters: CorredorFilters,
  page: number,
  pageSize: number
): Promise<{ data: CorredorRow[]; total: number }> {
  const needCityState = Boolean(filters.cidade?.trim() || filters.estado?.trim());
  const selectFields = needCityState
    ? "id, full_name, email, phone, preferred_distance, tipo_user, updated_at, credit_balance, city, state"
    : "id, full_name, email, phone, preferred_distance, tipo_user, updated_at, credit_balance";

  // Filtro de participação: 0 = só quem tem zero inscrições; >0 = mínimo de inscrições
  let userIdsParticipacao: string[] | null = null;
  let userIdsExcluirParaZero: string[] | null = null;
  if (filters.participacaoMin != null) {
    const { data: regs } = await supabase
      .from("competition_registrations")
      .select("user_id")
      .neq("status", "cancelled");
    const countByUser: Record<string, number> = {};
    (regs ?? []).forEach((r) => {
      countByUser[r.user_id] = (countByUser[r.user_id] ?? 0) + 1;
    });
    if (filters.participacaoMin === 0) {
      userIdsExcluirParaZero = Object.keys(countByUser);
    } else {
      userIdsParticipacao = Object.entries(countByUser)
        .filter(([, c]) => c >= filters.participacaoMin!)
        .map(([id]) => id);
      if (userIdsParticipacao.length === 0) {
        return { data: [], total: 0 };
      }
    }
  }

  let query = supabase
    .from("v_corredores_admin")
    .select(selectFields, { count: "exact" })
    .order("full_name", { ascending: true });

  const search = filters.search?.trim();
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  if (filters.tipoUser) {
    query = query.eq("tipo_user", filters.tipoUser);
  }
  if (filters.eParceiro === true && filters.naoEParceiro !== true) {
    query = query.eq("tipo_user", "Parceiro");
  }
  if (filters.naoEParceiro === true && filters.eParceiro !== true) {
    query = query.eq("tipo_user", "Corredor");
  }
  if (filters.preferredDistance) {
    query = query.ilike("preferred_distance", `%${filters.preferredDistance}%`);
  }
  if (filters.plano === "Gratuito") {
    query = query.eq("credit_balance", 0);
  } else if (filters.plano === "ComCreditos") {
    query = query.gte("credit_balance", 1);
  }
  if (filters.cidade?.trim()) {
    query = query.ilike("city", `%${filters.cidade.trim()}%`);
  }
  if (filters.estado?.trim()) {
    query = query.ilike("state", `%${filters.estado.trim()}%`);
  }
  if (userIdsParticipacao) {
    query = query.in("id", userIdsParticipacao);
  }
  if (userIdsExcluirParaZero && userIdsExcluirParaZero.length > 0) {
    query = query.not("id", "in", `(${userIdsExcluirParaZero.join(",")})`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: rows, error, count } = await query.range(from, to);

  if (error) throw error;

  const total = count ?? 0;
  const data: CorredorRow[] = (rows ?? []).map((r: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    preferred_distance: string | null;
    tipo_user: string | null;
    updated_at: string | null;
    credit_balance: number | null;
  }) => {
    const balance = Number(r.credit_balance) || 0;
    const plano = balance === 0 ? "Gratuito" : String(balance);
    return {
      id: r.id,
      nome: r.full_name ?? "—",
      email: r.email ?? "—",
      telefone: r.phone?.trim() || "—",
      preferencia: preferredDistanceToLabel(r.preferred_distance),
      vinculo: r.tipo_user === "Parceiro" ? "Corredor/parceiro" : "Corredor",
      ultimoAcesso: formatLastAccess(r.updated_at),
      plano,
    };
  });

  return { data, total };
}

export function useCorredores(
  filters: CorredorFilters,
  page: number,
  pageSize: number = PAGE_SIZE_DEFAULT
) {
  const [data, setData] = useState<CorredorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCorredores(filters, page, pageSize);
      setData(result.data);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar corredores"));
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.tipoUser,
    filters.eParceiro,
    filters.naoEParceiro,
    filters.preferredDistance,
    filters.participacaoMin,
    filters.plano,
    filters.cidade,
    filters.estado,
    page,
    pageSize,
  ]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useRealtimeRefetch(["profiles", "competition_registrations"], fetch);

  return { data, total, loading, error, refetch: fetch };
}

/** Busca todos os corredores com filtros (para exportação CSV) */
export async function fetchCorredoresForExport(filters: CorredorFilters): Promise<CorredorRow[]> {
  const result = await fetchCorredores(filters, 1, 10000);
  return result.data;
}
