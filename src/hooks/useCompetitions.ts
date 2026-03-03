import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CompetitionFilters } from "@/contexts/CompeticoesFilterContext";

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
};

type DbStatus = "draft" | "open" | "closed" | "in_progress" | "finished";

const mapStatus = (status: DbStatus | null): CompetitionStatus => {
  switch (status) {
    case "open":
      return "aberta";
    case "in_progress":
      return "em_andamento";
    case "finished":
    case "closed":
      return "finalizada";
    case "draft":
      return "rascunho";
    default:
      return "aberta";
  }
};

const formatDateRange = (start: string | null, end: string | null): string => {
  if (!start && !end) return "-";
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "2-digit" };
  const s = start ? new Date(start).toLocaleDateString("pt-BR", opts) : "";
  const e = end ? new Date(end).toLocaleDateString("pt-BR", opts) : "";
  if (s && e) return `${s} - ${e}`;
  return s || e;
};

const formatSingleDate = (date: string | null): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
};

/** Mapeia status do filtro (UI) para status do banco */
function statusToDb(status: string | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "aberta": return "open";
    case "em_andamento": return "in_progress";
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
    .select("id, title, subtitle, mode, format_type, status, is_free, starts_at, registration_starts_at, registration_ends_at, competition_sponsors, created_at")
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
      .from("competition_registrations")
      .select("competition_id")
      .neq("status", "cancelled")
      .in("competition_id", ids);
    (regs ?? []).forEach((r) => {
      countsByCompetition[r.competition_id] = (countsByCompetition[r.competition_id] ?? 0) + 1;
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
    prazoInscricoes: formatDateRange(c.registration_starts_at, c.registration_ends_at),
    prazoProva: formatSingleDate(c.starts_at),
    inscritos: countsByCompetition[c.id] ?? 0,
    tipo: c.is_free ? "Gratuita" : "Paga",
    formato: formatLabel(c.format_type),
    campeonato: "-",
    status: mapStatus(c.status as DbStatus),
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

  return { data, loading, error, refetch: fetchCompetitions };
}
