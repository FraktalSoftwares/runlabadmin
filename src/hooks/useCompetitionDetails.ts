import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

// ─── Types ───────────────────────────────────────────────

export type CompetitionDistance = {
  id: string;
  label: string;
  meters: number;
  sortOrder: number;
};

export type CompetitionLot = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  isSubscriptionAllowed: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type CompetitionDocument = {
  id: string;
  title: string;
  fileUrl: string;
  sortOrder: number;
};

export type CompetitionSponsor = {
  id: string;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
};

export type CompetitionDetail = {
  id: string;
  title: string;
  subtitle: string | null;
  locationName: string | null;
  startsAt: string;
  endsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  mode: string;
  formatType: string;
  formatObservations: string | null;
  status: string;
  isFree: boolean;
  coverImageUrl: string | null;
  description: string | null;
  prizeDescription: string | null;
  championshipId: string | null;
  unlimitedAttempts: boolean;
  maxRegistrations: number | null;
  distances: CompetitionDistance[];
  lots: CompetitionLot[];
  documents: CompetitionDocument[];
  sponsors: CompetitionSponsor[];
  stats: {
    totalAthletes: number;
    totalRegistrations: number;
    totalRevenueCents: number;
  };
};

export type RegistrationRow = {
  id: string;
  userName: string;
  userAvatar: string | null;
  distanceLabel: string | null;
  distanceMeters: number | null;
  attempts: number;
  priceCents: number | null;
  lotName: string | null;
  status: string;
  createdAt: string;
};

export type RankingRow = {
  position: number;
  userId: string;
  userName: string;
  userAvatar: string | null;
  paceSecondsPerKm: number | null;
  distanceMeters: number;
  totalTimeSeconds: number;
};

/** Filtros da aba Inscrições (competição) */
export type InscricoesFilters = {
  status?: "pending" | "confirmed" | "cancelled" | "all";
  distanceLabel?: string;
  distanceMeters?: number;
  isParceiro?: boolean;
  naoEParceiro?: boolean;
  participacaoMin?: number;
  cidade?: string;
  estado?: string;
  plano?: string;
};

// ─── Helpers ─────────────────────────────────────────────

export const formatPace = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return "-";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, "0")}/km`;
};

export const formatTime = (seconds: number | null): string => {
  if (seconds == null || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const formatDistanceKm = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2).replace(".", ",")}km`;
  }
  return `${meters}m`;
};

export const formatPrice = (cents: number | null): string => {
  if (cents === null || cents === undefined) return "-";
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
};

export const mapRegistrationStatus = (status: string): string => {
  switch (status) {
    case "pending":
      return "Pendente";
    case "confirmed":
      return "Confirmado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
};

export const mapCompetitionStatus = (status: string): string => {
  switch (status) {
    case "draft":
      return "Rascunho";
    case "open":
      return "Aberta";
    case "closed":
      return "Fechada";
    case "in_progress":
      return "Em andamento";
    case "finished":
      return "Finalizada";
    default:
      return status;
  }
};

export const formatDateBR = (date: string | null): string => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const formatDateRangeBR = (
  start: string | null,
  end: string | null
): string => {
  if (!start && !end) return "-";
  const s = start ? formatDateBR(start) : "";
  const e = end ? formatDateBR(end) : "";
  if (s && e) return `${s} - ${e}`;
  return s || e;
};

// ─── Hook: Competition Details ───────────────────────────

export function useCompetitionDetails(id: string | undefined) {
  const [data, setData] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch competition
      const { data: comp, error: compError } = await supabase
        .from("competitions")
        .select("*")
        .eq("id", id)
        .single();

      if (compError) throw compError;
      if (!comp) throw new Error("Competição não encontrada");

      // 2. Fetch distances
      const { data: distances } = await supabase
        .from("competition_distances")
        .select("*")
        .eq("competition_id", id)
        .order("sort_order");

      // 3. Fetch lots
      const { data: lots } = await supabase
        .from("competition_lots")
        .select("*")
        .eq("competition_id", id)
        .order("sort_order");

      // 4. Fetch documents
      const { data: documents } = await supabase
        .from("competition_documents")
        .select("*")
        .eq("competition_id", id)
        .order("sort_order");

      // 5. Fetch sponsors
      const sponsorIds: string[] = comp.competition_sponsors || [];
      let sponsors: CompetitionSponsor[] = [];
      if (sponsorIds.length > 0) {
        const { data: sponsorData } = await supabase
          .from("competition_sponsors")
          .select("*")
          .in("id", sponsorIds)
          .order("sort_order");

        sponsors = (sponsorData || []).map((s) => ({
          id: s.id,
          name: s.name,
          logoUrl: s.logo_url,
          sortOrder: s.sort_order,
        }));
      }

      // 6. Fetch registration stats
      const { data: registrations } = await supabase
        .from("competition_registrations")
        .select("id, user_id, lot_id, status")
        .eq("competition_id", id)
        .neq("status", "cancelled");

      const totalRegistrations = registrations?.length || 0;
      const uniqueUsers = new Set(registrations?.map((r) => r.user_id));
      const totalAthletes = uniqueUsers.size;

      // 7. Calculate revenue from confirmed registrations + lots
      let totalRevenueCents = 0;
      if (registrations && registrations.length > 0 && lots) {
        const lotPriceMap: Record<string, number> = {};
        (lots || []).forEach((l) => {
          lotPriceMap[l.id] = l.price_cents;
        });

        registrations
          .filter((r) => r.status === "confirmed" && r.lot_id)
          .forEach((r) => {
            totalRevenueCents += lotPriceMap[r.lot_id] || 0;
          });
      }

      setData({
        id: comp.id,
        title: comp.title,
        subtitle: comp.subtitle,
        locationName: comp.location_name,
        startsAt: comp.starts_at,
        endsAt: comp.ends_at ?? null,
        registrationStartsAt: comp.registration_starts_at,
        registrationEndsAt: comp.registration_ends_at,
        mode: comp.mode,
        formatType: comp.format_type ?? "oficial",
        formatObservations: comp.format_observations ?? null,
        status: comp.status,
        isFree: comp.is_free,
        coverImageUrl: comp.cover_image_url,
        description: comp.description,
        prizeDescription: comp.prize_description,
        championshipId: comp.championship_id,
        unlimitedAttempts: comp.unlimited_attempts ?? true,
        maxRegistrations: comp.max_registrations ?? null,
        distances: (distances || []).map((d) => ({
          id: d.id,
          label: d.label,
          meters: d.meters,
          sortOrder: d.sort_order,
        })),
        lots: (lots || []).map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          priceCents: l.price_cents,
          currency: l.currency,
          isSubscriptionAllowed: l.is_subscription_allowed,
          isActive: l.is_active,
          sortOrder: l.sort_order,
        })),
        documents: (documents || []).map((d) => ({
          id: d.id,
          title: d.title,
          fileUrl: d.file_url,
          sortOrder: d.sort_order,
        })),
        sponsors,
        stats: {
          totalAthletes,
          totalRegistrations,
          totalRevenueCents,
        },
      });
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Erro ao carregar detalhes")
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useRealtimeRefetch(
    ["competitions", "competition_distances", "competition_lots", "competition_documents", "competition_sponsors", "competition_registrations"],
    fetchDetails,
  );

  return { data, loading, error, refetch: fetchDetails };
}

// ─── Hook: Competition Registrations (paginated) ─────────

const LABEL_TO_METERS: Record<string, number> = {
  "3 km": 3000,
  "5 km": 5000,
  "10 km": 10000,
  "21 km": 21000,
  "42 km": 42000,
};

export function useCompetitionRegistrations(
  competitionId: string | undefined,
  page: number = 1,
  pageSize: number = 10,
  filters: InscricoesFilters = {}
) {
  const [data, setData] = useState<RegistrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRegistrations = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true);
    setError(null);

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Optional: restrict by user_ids (parceiro / participação)
      let filterUserIds: string[] | null = null;

      if (filters.isParceiro && !filters.naoEParceiro) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id")
          .eq("tipo_user", "Parceiro");
        filterUserIds = (profs ?? []).map((p) => p.id);
        if (filterUserIds.length === 0) {
          setData([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      } else if (filters.naoEParceiro && !filters.isParceiro) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id")
          .neq("tipo_user", "Parceiro");
        filterUserIds = (profs ?? []).map((p) => p.id);
      }

      if (filters.participacaoMin != null && filters.participacaoMin > 0) {
        const { data: regs } = await supabase
          .from("competition_registrations")
          .select("user_id")
          .neq("status", "cancelled");
        const countByUser: Record<string, number> = {};
        (regs ?? []).forEach((r) => {
          countByUser[r.user_id] = (countByUser[r.user_id] ?? 0) + 1;
        });
        const userIdsParticipacao = Object.entries(countByUser)
          .filter(([, c]) => c >= filters.participacaoMin!)
          .map(([id]) => id);
        if (userIdsParticipacao.length === 0) {
          setData([]);
          setTotal(0);
          setLoading(false);
          return;
        }
        filterUserIds =
          filterUserIds === null
            ? userIdsParticipacao
            : filterUserIds.filter((id) => userIdsParticipacao.includes(id));
        if (filterUserIds.length === 0) {
          setData([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      // Optional: distance_ids for this competition
      let distanceIds: string[] | null = null;
      if (filters.distanceLabel || (filters.distanceMeters != null && filters.distanceMeters > 0)) {
        let query = supabase
          .from("competition_distances")
          .select("id")
          .eq("competition_id", competitionId);
        if (filters.distanceLabel) {
          const meters = LABEL_TO_METERS[filters.distanceLabel];
          if (meters != null) {
            query = query.eq("meters", meters);
          } else {
            query = query.eq("label", filters.distanceLabel!);
          }
        } else {
          query = query.eq("meters", filters.distanceMeters!);
        }
        const { data: dists } = await query;
        distanceIds = (dists ?? []).map((d) => d.id);
        if (distanceIds.length === 0) {
          setData([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      let query = supabase
        .from("competition_registrations")
        .select("id, user_id, distance_id, lot_id, status, created_at", {
          count: "exact",
        })
        .eq("competition_id", competitionId)
        .order("created_at", { ascending: false });

      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      } else {
        query = query.neq("status", "cancelled");
      }
      if (filterUserIds && filterUserIds.length > 0) {
        query = query.in("user_id", filterUserIds);
      }
      if (distanceIds && distanceIds.length > 0) {
        query = query.in("distance_id", distanceIds);
      }

      const {
        data: regs,
        error: regsError,
        count,
      } = await query.range(from, to);

      if (regsError) throw regsError;
      setTotal(count || 0);

      if (!regs || regs.length === 0) {
        setData([]);
        return;
      }

      // Fetch profiles for user_ids
      const userIds = [...new Set(regs.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap: Record<
        string,
        { full_name: string | null; avatar_url: string | null }
      > = {};
      (profiles || []).forEach((p) => {
        profileMap[p.id] = p;
      });

      // Fetch distances for the fetched registrations
      const regDistanceIds = [
        ...new Set(regs.filter((r) => r.distance_id).map((r) => r.distance_id)),
      ];
      const distanceMap: Record<string, { label: string; meters: number }> = {};
      if (regDistanceIds.length > 0) {
        const { data: dists } = await supabase
          .from("competition_distances")
          .select("id, label, meters")
          .in("id", regDistanceIds);
        (dists || []).forEach((d) => {
          distanceMap[d.id] = d;
        });
      }

      // Fetch lots
      const lotIds = [
        ...new Set(regs.filter((r) => r.lot_id).map((r) => r.lot_id)),
      ];
      const lotMap: Record<string, { name: string; price_cents: number }> = {};
      if (lotIds.length > 0) {
        const { data: lotsData } = await supabase
          .from("competition_lots")
          .select("id, name, price_cents")
          .in("id", lotIds);
        (lotsData || []).forEach((l) => {
          lotMap[l.id] = l;
        });
      }

      // Fetch attempt counts (user_runs per user for this competition)
      const { data: runs } = await supabase
        .from("user_runs")
        .select("user_id")
        .eq("competition_id", competitionId)
        .in("user_id", userIds);

      const attemptsByUser: Record<string, number> = {};
      (runs || []).forEach((r) => {
        attemptsByUser[r.user_id] = (attemptsByUser[r.user_id] || 0) + 1;
      });

      const rows: RegistrationRow[] = regs.map((r) => {
        const profile = profileMap[r.user_id];
        const distance = r.distance_id ? distanceMap[r.distance_id] : null;
        const lot = r.lot_id ? lotMap[r.lot_id] : null;
        return {
          id: r.id,
          userName: profile?.full_name || "Usuário desconhecido",
          userAvatar: profile?.avatar_url || null,
          distanceLabel: distance?.label || null,
          distanceMeters: distance?.meters || null,
          attempts: attemptsByUser[r.user_id] || 0,
          priceCents: lot?.price_cents ?? null,
          lotName: lot?.name || null,
          status: r.status,
          createdAt: r.created_at,
        };
      });

      setData(rows);
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Erro ao carregar inscrições")
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId, page, pageSize, filters]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  useRealtimeRefetch(["competition_registrations"], fetchRegistrations);

  return { data, total, loading, error, refetch: fetchRegistrations };
}

// ─── Hook: Competition Ranking (paginated) ───────────────

export function useCompetitionRanking(
  competitionId: string | undefined,
  page: number = 1,
  pageSize: number = 10
) {
  const [data, setData] = useState<RankingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRanking = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true);
    setError(null);

    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Espelha o ranking do app mobile: v_competition_leaderboard já aplica
      // os filtros de validação (>=99% da distância da prova + pace 210-1800
      // s/km) e devolve `rank` particionado por distância. Filtramos apenas
      // corridas finalizadas porque o admin lista etapa fechada.
      const {
        data: runs,
        error: runsError,
        count,
      } = await supabase
        .from("v_competition_leaderboard")
        .select(
          "run_id, user_id, distance_meters, avg_pace_seconds_per_km, total_time_seconds, rank, user_name, user_avatar_url",
          { count: "exact" }
        )
        .eq("competition_id", competitionId)
        .eq("state", "finished")
        .order("distance_meters", { ascending: true })
        .order("rank", { ascending: true })
        .range(from, to);

      if (runsError) throw runsError;
      setTotal(count || 0);

      if (!runs || runs.length === 0) {
        setData([]);
        return;
      }

      const rows: RankingRow[] = runs.map((r) => ({
        position: r.rank,
        userId: r.user_id,
        userName: r.user_name || "Usuário desconhecido",
        userAvatar: r.user_avatar_url || null,
        paceSecondsPerKm: r.avg_pace_seconds_per_km,
        distanceMeters: r.distance_meters,
        totalTimeSeconds: r.total_time_seconds,
      }));

      setData(rows);
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Erro ao carregar ranking")
      );
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [competitionId, page, pageSize]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  useRealtimeRefetch(["user_runs", "user_run_events"], fetchRanking);

  return { data, total, loading, error, refetch: fetchRanking };
}

// ─── CSV Export Helpers ──────────────────────────────────

export function generateCsv(headers: string[], rows: string[][]): string {
  const csvRows = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${(cell ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  return csvRows.join("\n");
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Exports all registrations for a competition as CSV */
export async function exportRegistrationsCsv(competitionId: string) {
  // Fetch ALL registrations (no pagination)
  const { data: regs, error: regsError } = await supabase
    .from("competition_registrations")
    .select("id, user_id, distance_id, lot_id, status, created_at")
    .eq("competition_id", competitionId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (regsError) throw regsError;
  if (!regs || regs.length === 0) {
    throw new Error("Nenhuma inscrição para exportar");
  }

  const userIds = [...new Set(regs.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", userIds);

  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p) => {
    profileMap[p.id] = p.full_name || "Desconhecido";
  });

  const distanceIds = [
    ...new Set(regs.filter((r) => r.distance_id).map((r) => r.distance_id)),
  ];
  const distanceMap: Record<string, string> = {};
  if (distanceIds.length > 0) {
    const { data: dists } = await supabase
      .from("competition_distances")
      .select("id, label")
      .in("id", distanceIds);
    (dists || []).forEach((d) => {
      distanceMap[d.id] = d.label;
    });
  }

  const lotIds = [
    ...new Set(regs.filter((r) => r.lot_id).map((r) => r.lot_id)),
  ];
  const lotMap: Record<string, { name: string; price_cents: number }> = {};
  if (lotIds.length > 0) {
    const { data: lotsData } = await supabase
      .from("competition_lots")
      .select("id, name, price_cents")
      .in("id", lotIds);
    (lotsData || []).forEach((l) => {
      lotMap[l.id] = l;
    });
  }

  const { data: runs } = await supabase
    .from("user_runs")
    .select("user_id")
    .eq("competition_id", competitionId)
    .in("user_id", userIds);

  const attemptsByUser: Record<string, number> = {};
  (runs || []).forEach((r) => {
    attemptsByUser[r.user_id] = (attemptsByUser[r.user_id] || 0) + 1;
  });

  const headers = ["Nome", "Distância", "Tentativas", "Lote", "Valor", "Status", "Data de inscrição"];
  const rows = regs.map((r) => {
    const lot = r.lot_id ? lotMap[r.lot_id] : null;
    return [
      profileMap[r.user_id] || "Desconhecido",
      r.distance_id ? distanceMap[r.distance_id] || "-" : "-",
      String(attemptsByUser[r.user_id] || 0),
      lot?.name || "-",
      lot ? formatPrice(lot.price_cents) : "-",
      mapRegistrationStatus(r.status),
      new Date(r.created_at).toLocaleDateString("pt-BR"),
    ];
  });

  const csv = generateCsv(headers, rows);
  downloadCsv(csv, `inscricoes-${competitionId}.csv`);
}

/** Exports ranking (best run per runner) as CSV — mesma fonte do app mobile */
export async function exportRankingCsv(competitionId: string) {
  const { data: runs, error: runsError } = await supabase
    .from("v_competition_leaderboard")
    .select(
      "user_id, distance_meters, avg_pace_seconds_per_km, total_time_seconds, rank, user_name"
    )
    .eq("competition_id", competitionId)
    .eq("state", "finished")
    .order("distance_meters", { ascending: true })
    .order("rank", { ascending: true });

  if (runsError) throw runsError;
  if (!runs || runs.length === 0) {
    throw new Error("Nenhum resultado no ranking para exportar");
  }

  const headers = ["Distância", "Posição", "Corredor", "Pace", "Tempo"];
  const rows = runs.map((r) => [
    formatDistanceKm(r.distance_meters),
    `${r.rank}º`,
    r.user_name || "Desconhecido",
    formatPace(r.avg_pace_seconds_per_km),
    formatTime(r.total_time_seconds),
  ]);

  const csv = generateCsv(headers, rows);
  downloadCsv(csv, `ranking-${competitionId}.csv`);
}
