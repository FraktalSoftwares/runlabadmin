import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CompetitionFilters } from "@/contexts/CompeticoesFilterContext";
import { useRealtimeRefetch } from "./useSupabaseRealtime";
import { formatLocalDate, formatLocalDateRange, resolveLocalDate } from "@/lib/localDate";

export type CompetitionStatus = "aberta" | "em_andamento" | "finalizada" | "fechada" | "rascunho";

export type CompetitionRow = {
  id: string;
  nome: string;
  modalidade: string;
  prazoInscricoes: string;
  prazoProva: string;
  inscritos: number;
  tipo: string;
  formato: string;
  campeonato: string;
  status: CompetitionStatus;
  regulamento: {
    count: number;
    title: string;
    fileUrl: string;
  } | null;
};

type DbStatus = "draft" | "open" | "closed" | "in_progress" | "finished";

const mapStatus = (status: DbStatus | null): CompetitionStatus => {
  switch (status) {
    case "open":
      return "aberta";
    case "in_progress":
      return "em_andamento";
    case "finished":
      return "finalizada";
    case "closed":
      return "fechada";
    case "draft":
      return "rascunho";
    default:
      return "aberta";
  }
};

const formatDateRange = (start: string | null, end: string | null): string => {
  return formatLocalDateRange(start, end);
};

const formatSingleDate = (date: string | null): string => {
  return formatLocalDate(date);
};

/** Mapeia status do filtro (UI) para status do banco */
function statusToDb(status: string | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "aberta": return "open";
    case "em_andamento": return "in_progress";
    case "fechada": return "closed";
    case "finalizada": return "finished";
    case "rascunho": return "draft";
    default: return null;
  }
}

/** Retorna data ISO a partir de X dias atrás */
function periodToDate(periodo: string | undefined): string | null {
  if (!periodo) return null;
  const now = new Date();
  switch (periodo) {
    case "30dias":
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    case "6meses":
      now.setMonth(now.getMonth() - 6);
      return now.toISOString();
    case "ano":
      now.setFullYear(now.getFullYear() - 1);
      return now.toISOString();
    default:
      return null;
  }
}

async function fetchCompetitionsWithFilters(filters: CompetitionFilters = {}): Promise<CompetitionRow[]> {
  let query = supabase
    .from("competitions")
    .select("id, title, subtitle, mode, format_type, status, is_free, starts_on, ends_on, registration_starts_on, registration_ends_on, starts_at, ends_at, registration_starts_at, registration_ends_at, competition_sponsors, created_at, championship_id")
    .order("created_at", { ascending: false });

  const dbStatus = statusToDb(filters.status);
  if (dbStatus) query = query.eq("status", dbStatus);
  if (filters.tipo === "gratuita") query = query.eq("is_free", true);
  if (filters.tipo === "paga") query = query.eq("is_free", false);
  const modeDb = (filters.modalidade === "indoor" || filters.modalidade === "outdoor" || filters.modalidade === "mista") ? filters.modalidade : null;
  if (modeDb) query = query.eq("mode", modeDb);
  const periodFrom = periodToDate(filters.periodo);
  if (periodFrom) query = query.gte("created_at", periodFrom);
  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim()}%`);

  const { data: competitions, error: compError } = await query;
  if (compError) throw compError;

  const ids = (competitions ?? []).map((c) => c.id);
  const countsByCompetition: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: regs } = await supabase
      .from("v_admin_competition_registered_users")
      .select("competition_id")
      .neq("status", "cancelled")
      .in("competition_id", ids);
    (regs ?? []).forEach((r) => {
      countsByCompetition[r.competition_id] = (countsByCompetition[r.competition_id] ?? 0) + 1;
    });
  }

  const { data: documents, error: documentsError } = ids.length > 0
    ? await supabase
      .from("competition_documents")
      .select("competition_id, title, file_url, sort_order")
      .in("competition_id", ids)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (documentsError) throw documentsError;

  const documentsByCompetition: Record<string, { title: string; fileUrl: string }[]> = {};
  (documents ?? []).forEach((document) => {
    const list = documentsByCompetition[document.competition_id] ?? [];
    list.push({
      title: document.title,
      fileUrl: document.file_url,
    });
    documentsByCompetition[document.competition_id] = list;
  });

  // Buscar nomes dos campeonatos vinculados
  const championshipIds = [...new Set(
    (competitions ?? []).map((c) => c.championship_id).filter(Boolean)
  )];
  const championshipNames: Record<string, string> = {};
  if (championshipIds.length > 0) {
    const { data: champs } = await supabase
      .from("championships")
      .select("id, name")
      .in("id", championshipIds);
    (champs ?? []).forEach((ch: { id: string; name: string }) => {
      championshipNames[ch.id] = ch.name;
    });
  }

  const modeLabel = (mode: string | null): string => {
    switch (mode) {
      case "indoor": return "Indoor";
      case "outdoor": return "Outdoor";
      case "mista": return "Mista";
      default: return "Outdoor";
    }
  };

  const formatLabel = (ft: string | null): string => {
    switch (ft) {
      case "oficial": return "Oficial";
      case "patrocinada": return "Patrocinada";
      case "personalizado": return "Personalizado";
      default: return "Oficial";
    }
  };

  return (competitions ?? []).map((c) => ({
    id: c.id,
    nome: c.title ?? "-",
    modalidade: modeLabel(c.mode),
    prazoInscricoes: formatDateRange(
      resolveLocalDate(c.registration_starts_on, c.registration_starts_at),
      resolveLocalDate(c.registration_ends_on, c.registration_ends_at),
    ),
    prazoProva: formatSingleDate(resolveLocalDate(c.starts_on, c.starts_at)),
    inscritos: countsByCompetition[c.id] ?? 0,
    tipo: c.is_free ? "Gratuita" : "Paga",
    formato: formatLabel(c.format_type),
    campeonato: c.championship_id ? (championshipNames[c.championship_id] ?? "-") : "-",
    status: mapStatus(c.status as DbStatus),
    regulamento: documentsByCompetition[c.id]?.length
      ? {
        count: documentsByCompetition[c.id].length,
        title: documentsByCompetition[c.id][0].title,
        fileUrl: documentsByCompetition[c.id][0].fileUrl,
      }
      : null,
  }));
}

/** Busca competições com filtros para exportação CSV */
export async function fetchCompetitionsForExport(filters: CompetitionFilters = {}): Promise<CompetitionRow[]> {
  return fetchCompetitionsWithFilters(filters);
}

export function useCompetitions(filters: CompetitionFilters = {}) {
  const [data, setData] = useState<CompetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCompetitionsWithFilters(filters);
      setData(rows);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar competições"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
    filters.status,
    filters.tipo,
    filters.modalidade,
    filters.periodo,
    filters.search,
  ]);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  useRealtimeRefetch(
    ["competitions", "competition_registrations", "competition_documents"],
    fetchCompetitions,
  );

  return { data, loading, error, refetch: fetchCompetitions };
}
