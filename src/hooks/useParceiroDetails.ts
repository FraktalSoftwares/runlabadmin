import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/** Nível do usuário (tabela levels): id, level, name, badge_slug + imagem do badge se houver */
export type LevelInfo = {
  id: number;
  level: number;
  name: string;
  badge_slug: string | null;
  badge_image_url: string | null;
};

export type ParceiroDetails = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  type: string;
  nivel: number;
  /** Nível do usuário (tabela levels) */
  levelInfo: LevelInfo | null;
  lastAccess: string;
  status: string;
  avatar: string | null;
  cadastro: string;
  formData: {
    instagram: string;
    link: string;
    telefone: string;
    email: string;
    site: string;
    descricao: string;
  };
  stats: {
    inscricoes: number;
    eventos: number;
    receita: string;
  };
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatLastAccess(updatedAt: string | null): string {
  if (!updatedAt) return "—";
  const d = new Date(updatedAt);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " • " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function mapPartnershipStatus(status: string | null): string {
  if (!status) return "—";
  const s = status.toLowerCase();
  if (s === "pending" || s === "em_analise") return "Em análise";
  if (s === "approved" || s === "ativo") return "Ativo";
  if (s === "rejected" || s === "rejeitado") return "Rejeitado";
  if (s === "inactive" || s === "inativo") return "Inativo";
  return status;
}

export function useParceiroDetails(id: string | undefined) {
  const [data, setData] = useState<ParceiroDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [profileRes, partnershipRes, regsRes, runsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url, updated_at, created_at, tipo_user, current_level").eq("id", id).single(),
        supabase
          .from("partnership_requests")
          .select("partner_type, description, instagram, tiktok, youtube, site, email, phone, city, state, status, created_at")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("competition_registrations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", id)
          .neq("status", "cancelled"),
        supabase
          .from("user_runs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", id)
          .eq("state", "finished"),
      ]);

      const profile = profileRes.data;
      const partnership = partnershipRes.data;
      const profileError = profileRes.error;
      if (profileError && profileError.code !== "PGRST116") throw profileError;

      let name = "—";
      let email = "—";
      let lastAccess = "—";
      let avatar: string | null = null;
      let nivel = 1;
      let cadastro = "—";

      if (profile) {
        name = (profile.full_name ?? "").trim() || "—";
        lastAccess = formatLastAccess(profile.updated_at);
        avatar = profile.avatar_url ?? null;
        nivel = Number(profile.current_level) || 1;
        cadastro = formatDate(profile.created_at);
      }

      if (partnership) {
        email = (partnership.email ?? "").trim() || email;
      }
      if (email === "—" && profile) {
        const { data: viewRow } = await supabase
          .from("v_corredores_admin")
          .select("email")
          .eq("id", id)
          .single();
        if (viewRow?.email) email = String(viewRow.email).trim();
      }

      if (!profile && !partnership) {
        setData(null);
        setError(new Error("Parceiro não encontrado."));
        setLoading(false);
        return;
      }

      const phone = (partnership?.phone ?? "").trim() || "—";
      const city = (partnership?.city ?? "").trim() || "—";
      const state = (partnership?.state ?? "").trim() || "—";
      const type = (partnership?.partner_type ?? "").trim() || "—";
      const status = mapPartnershipStatus(partnership?.status ?? null);
      if (partnership?.created_at) cadastro = formatDate(partnership.created_at);

      const inscricoes = regsRes.count ?? 0;
      const eventos = runsRes.count ?? 0;

      let levelInfo: LevelInfo | null = null;
      const currentLevel = profile ? Number(profile.current_level) || null : null;
      if (currentLevel != null) {
        const { data: levelRow } = await supabase
          .from("levels")
          .select("id, level, name, badge_slug")
          .eq("id", currentLevel)
          .single();
        if (levelRow) {
          let badge_image_url: string | null = null;
          if (levelRow.badge_slug) {
            const { data: badgeRow } = await supabase
              .from("badges")
              .select("image_url")
              .eq("slug", levelRow.badge_slug)
              .maybeSingle();
            badge_image_url = badgeRow?.image_url ?? null;
          }
          levelInfo = {
            id: levelRow.id,
            level: levelRow.level,
            name: levelRow.name ?? "—",
            badge_slug: levelRow.badge_slug ?? null,
            badge_image_url,
          };
        }
      }

      setData({
        id,
        name,
        email,
        phone,
        city,
        state,
        type,
        nivel,
        levelInfo,
        lastAccess,
        status,
        avatar,
        cadastro,
        formData: {
          instagram: (partnership?.instagram ?? "").trim() || "—",
          link: (partnership?.instagram ?? partnership?.tiktok ?? partnership?.youtube ?? "").trim() || "—",
          telefone: (partnership?.phone ?? "").trim() || "—",
          email: (partnership?.email ?? "").trim() || "—",
          site: (partnership?.site ?? "").trim() || "—",
          descricao: (partnership?.description ?? "").trim() || "—",
        },
        stats: {
          inscricoes,
          eventos,
          receita: "—",
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar parceiro"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { data, loading, error, refetch: fetchDetails };
}
