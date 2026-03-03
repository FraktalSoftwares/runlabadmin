import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

/** View que já faz join com profiles e traz applicant_name (full_name do solicitante). */
const PARTNER_REQUESTS_VIEW = "v_partnership_requests_with_profile";

/**
 * Colunas da view: id, user_id, status, partner_type, email, phone, created_at, applicant_name.
 * applicant_name vem de profiles.full_name (nome do solicitante).
 */
export type PartnerRequestRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string;
  cpfCnpj: string;
  type: string;
  requestDate: string;
};

function formatRequestDate(createdAt: string | null): string {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function usePartnerRequests() {
  const [data, setData] = useState<PartnerRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: fetchError } = await supabase
        .from(PARTNER_REQUESTS_VIEW)
        .select("id, user_id, status, partner_type, email, phone, created_at, applicant_name")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const list = rows ?? [];
      const result: PartnerRequestRow[] = list.map((r: Record<string, unknown>) => {
        return {
          id: String(r.id),
          user_id: String(r.user_id),
          name: ((r.applicant_name as string) ?? "").trim() || "—",
          email: (r.email as string) ?? "—",
          phone: (r.phone as string) ?? "—",
          cpfCnpj: "—",
          type: (r.partner_type as string) ?? "—",
          requestDate: formatRequestDate((r.created_at as string) ?? null),
        };
      });

      setData(result);
    } catch (e) {
      const raw = e instanceof Error ? e : new Error("Erro ao carregar solicitações de parceiros");
      const msg = raw instanceof Error ? raw.message : String(raw);
      const isMissingTable =
        msg.includes("does not exist") || msg.includes("relation") || msg.includes("not find");
      const err = isMissingTable
        ? new Error(
            `A view '${PARTNER_REQUESTS_VIEW}' não existe no banco. Verifique no Supabase.`
          )
        : raw;
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
