import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

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
  /** Cupom/código de referência do parceiro */
  referralCode: string | null;
  /** Dados bancários do parceiro */
  bankData: {
    bank: string;
    agency: string;
    account: string;
    pixKey: string;
    cpfCnpj: string;
    businessName: string;
  };
  /** Experiência de corrida do perfil */
  runningExperience: string;
  /** Posição no ranking global do campeonato */
  rankingPosition: string;
  /** Badges do usuário */
  userBadges: Array<{ name: string; imageUrl: string | null }>;
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
        supabase.from("profiles").select("id, full_name, avatar_url, updated_at, created_at, tipo_user, current_level, referral_code, running_experience, partner_bank, partner_agency, partner_account, partner_pix_key, cpf_cnpj, business_name").eq("id", id).single(),
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
      let referralCode: string | null = null;
      let runningExperience = "—";
      let bankData = { bank: "—", agency: "—", account: "—", pixKey: "—", cpfCnpj: "—", businessName: "—" };

      if (profile) {
        name = (profile.full_name ?? "").trim() || "—";
        lastAccess = formatLastAccess(profile.updated_at);
        avatar = profile.avatar_url ?? null;
        nivel = Number(profile.current_level) || 1;
        cadastro = formatDate(profile.created_at);
        referralCode = profile.referral_code ?? null;
        runningExperience = profile.running_experience ?? "—";
        bankData = {
          bank: profile.partner_bank ?? "—",
          agency: profile.partner_agency ?? "—",
          account: profile.partner_account ?? "—",
          pixKey: profile.partner_pix_key ?? "—",
          cpfCnpj: profile.cpf_cnpj ?? "—",
          businessName: profile.business_name ?? "—",
        };
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

      // Buscar posição no ranking global do campeonato
      let rankingPosition = "—";
      try {
        const { data: rankRow } = await supabase
          .from("v_global_championship_ranking")
          .select("position")
          .eq("user_id", id)
          .maybeSingle();
        if (rankRow) rankingPosition = `${rankRow.position}º`;
      } catch { /* view pode não existir */ }

      // Buscar badges do usuário
      let userBadges: Array<{ name: string; imageUrl: string | null }> = [];
      try {
        const { data: ubRows } = await supabase
          .from("user_badges")
          .select("badge_id, badges(name, image_url)")
          .eq("user_id", id);
        if (ubRows) {
          userBadges = ubRows.map((ub: { badges?: { name?: string; image_url?: string } | null }) => ({
            name: ub.badges?.name ?? "—",
            imageUrl: ub.badges?.image_url ?? null,
          }));
        }
      } catch { /* tabela pode não existir */ }

      // Adicionar o badge de nível se não estiver nos user_badges
      if (levelInfo?.badge_image_url && !userBadges.some(b => b.name === levelInfo.name)) {
        userBadges.unshift({ name: levelInfo.name, imageUrl: levelInfo.badge_image_url });
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
        referralCode,
        bankData,
        runningExperience,
        rankingPosition,
        userBadges,
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

  useRealtimeRefetch(["profiles", "partnership_requests", "competition_registrations", "user_runs"], fetchDetails);

  return { data, loading, error, refetch: fetchDetails };
}
