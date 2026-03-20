import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

export type PartnerRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  type: string;
  lastAccess: string;
  status: "Ativo" | "Em analise" | "Rejeitado" | "Inativo";
};

const PAGE_SIZE_DEFAULT = 10;

function formatLastAccess(updatedAt: string | null): string {
  if (!updatedAt) return "—";
  const d = new Date(updatedAt);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " • " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function mapStatus(s: string | null): PartnerRow["status"] {
  if (!s) return "Ativo";
  const t = s.toLowerCase();
  if (t === "pending" || t === "em_analise") return "Em analise";
  if (t === "rejected" || t === "rejeitado") return "Rejeitado";
  if (t === "inactive" || t === "inativo") return "Inativo";
  return "Ativo";
}

export type PartnersFilters = {
  search?: string;
  status?: string;
  type?: string;
};

async function fetchPartners(
  filters: PartnersFilters,
  page: number,
  pageSize: number
): Promise<{ data: PartnerRow[]; total: number }> {
  // Parceiros = quem tem partnership_requests com status 'approved' ou 'inactive' (ativo ou inativo)
  const { data: prRows, error: prError } = await supabase
    .from("partnership_requests")
    .select("user_id, partner_type, phone, email, status, created_at")
    .in("status", ["approved", "inactive"])
    .order("created_at", { ascending: false });

  if (prError) throw prError;

  const listPr = prRows ?? [];
  const byUser = new Map<string, { partner_type: string; phone: string; email: string; status: string }>();
  const userIdsFromPr = new Set<string>();
  listPr.forEach((r: { user_id: string; partner_type?: string; phone?: string; email?: string; status?: string }) => {
    if (byUser.has(r.user_id)) return;
    userIdsFromPr.add(r.user_id);
    byUser.set(r.user_id, {
      partner_type: r.partner_type ?? "—",
      phone: r.phone ?? "—",
      email: r.email ?? "—",
      status: r.status ?? "approved",
    });
  });

  const userIds = Array.from(userIdsFromPr);
  if (userIds.length === 0) {
    return { data: [], total: 0 };
  }

  const { data: profiles, error: profError } = await supabase
    .from("profiles")
    .select("id, full_name, updated_at")
    .in("id", userIds)
    .order("full_name", { ascending: true });

  if (profError) throw profError;

  let list = (profiles ?? []) as { id: string; full_name: string | null; updated_at: string | null }[];
  const search = filters.search?.trim();
  if (search) {
    const term = search.toLowerCase();
    list = list.filter((r) => (r.full_name ?? "").toLowerCase().includes(term));
  }

  if (filters.status) {
    const target = filters.status;
    list = list.filter((r) => {
      const pr = byUser.get(r.id);
      return mapStatus(pr?.status ?? null) === target;
    });
  }

  if (filters.type) {
    const target = filters.type.toLowerCase();
    list = list.filter((r) => {
      const pr = byUser.get(r.id);
      return (pr?.partner_type ?? "").toLowerCase() === target;
    });
  }

  const total = list.length;
  const from = (page - 1) * pageSize;
  const pageList = list.slice(from, from + pageSize);
  const pageIds = pageList.map((r) => r.id);

  const viewRes = await supabase.from("v_corredores_admin").select("id, email").in("id", pageIds);
  const emailByUser = new Map<string, string>();
  (viewRes.data ?? []).forEach((r: { id: string; email?: string | null }) => {
    if (r.email) emailByUser.set(r.id, r.email);
  });

  const data: PartnerRow[] = pageList.map((r) => {
    const pr = byUser.get(r.id);
    const email = pr?.email?.trim() || emailByUser.get(r.id) || "—";
    return {
      id: r.id,
      name: (r.full_name ?? "").trim() || "—",
      email: email || "—",
      phone: (pr?.phone ?? "").trim() || "—",
      cpfCnpj: "—",
      type: (pr?.partner_type ?? "").trim() || "—",
      lastAccess: formatLastAccess(r.updated_at),
      status: mapStatus(pr?.status ?? null),
    };
  });

  return { data, total };
}

export function usePartners(filters: PartnersFilters, page: number, pageSize: number = PAGE_SIZE_DEFAULT) {
  const [data, setData] = useState<PartnerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPartners(filters, page, pageSize);
      setData(result.data);
      setTotal(result.total);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar parceiros"));
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, filters.type, page, pageSize]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useRealtimeRefetch(["partnership_requests", "profiles"], fetch);

  return { data, total, loading, error, refetch: fetch };
}
