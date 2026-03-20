import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

export type CampeonatoRow = {
  id: string;
  nome: string;
  nomeReduzido: string;
  etapas: number;
  periodo: string;
  tipoRanking: string;
};

const formatPeriod = (start: string | null, end: string | null): string => {
  if (!start && !end) return "-";
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", year: "2-digit" };
  const s = start ? new Date(start).toLocaleDateString("pt-BR", opts) : "";
  const e = end ? new Date(end).toLocaleDateString("pt-BR", opts) : "";
  if (s && e) return `${s} - ${e}`;
  return s || e;
};

const mapRankingType = (type: string | null): string => {
  switch (type) {
    case "ranking_soma":
      return "Ranking soma";
    case "ranking_media":
      return "Ranking média";
    case "ranking_etapa":
      return "Ranking por etapa";
    case "ranking_geral":
      return "Ranking geral";
    default:
      return type ?? "-";
  }
};

export function useCampeonatos() {
  const [data, setData] = useState<CampeonatoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCampeonatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: fetchError } = await supabase
        .from("championships")
        .select("id, name, short_name, stages_count, period_start, period_end, ranking_type")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const mapped: CampeonatoRow[] = (rows ?? []).map((c) => ({
        id: c.id,
        nome: c.name ?? "-",
        nomeReduzido: c.short_name ?? "-",
        etapas: c.stages_count ?? 0,
        periodo: formatPeriod(c.period_start, c.period_end),
        tipoRanking: mapRankingType(c.ranking_type),
      }));

      setData(mapped);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar campeonatos"));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampeonatos();
  }, [fetchCampeonatos]);

  useRealtimeRefetch(["championships"], fetchCampeonatos);

  return { data, loading, error, refetch: fetchCampeonatos };
}
