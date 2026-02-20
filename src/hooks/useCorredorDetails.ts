import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type RunnerPayment = {
  id: string;
  plan_type: "avulsa" | "anual";
  plan_name: string;
  billing_type: string;
  amount: number;
  status: string;
  installment_count: number | null;
  paid_at: string | null;
  created_at: string;
};

export type CreditTransaction = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
};

export type CorredorDetails = {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  city: string;
  state: string;
  gender: string;
  modality: string;
  lastAccess: string;
  level: number;
  plan: string;
  avatar: string | null;
  creditBalance: number;
  stats: {
    provasConcluidas: number;
    assinaturas: number;
    distancia: string;
  };
  payments: RunnerPayment[];
  creditTransactions: CreditTransaction[];
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
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

function preferredToModality(preferred: string | null): string {
  if (!preferred) return "—";
  if (preferred === "indoor") return "Corrida indoor";
  if (preferred === "outdoor") return "Corrida outdoor";
  return preferred;
}

function derivePlanLabel(payments: RunnerPayment[], creditBalance: number): string {
  const paid = payments.filter((p) => p.status === "CONFIRMED" || p.status === "RECEIVED");
  const hasCredits = creditBalance > 0;
  if (paid.length === 0 && !hasCredits) return "Gratuito";
  if (paid.length === 0 && hasCredits) return "Com créditos disponíveis";
  const hasAnual = paid.some((p) => p.plan_type === "anual");
  if (hasAnual) return "Plus";
  return "Essencial";
}

const BILLING_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  PIX: "PIX",
  BOLETO: "Boleto",
};

export function useCorredorDetails(id: string | undefined) {
  const [data, setData] = useState<CorredorDetails | null>(null);
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
      const { data: row, error: viewError } = await supabase
        .from("v_corredores_admin")
        .select("id, full_name, email, birth_date, gender, preferred_distance, avatar_url, tipo_user, updated_at, credit_balance")
        .eq("id", id)
        .single();

      if (viewError) throw viewError;
      if (!row) {
        setData(null);
        setLoading(false);
        return;
      }

      const userId = row.id as string;

      const [regsResult, runsResult, paymentsResult, creditsResult] = await Promise.all([
        supabase
          .from("competition_registrations")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .neq("status", "cancelled"),
        supabase
          .from("user_runs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("state", "finished"),
        supabase
          .from("runner_payments")
          .select("id, plan_type, description, billing_type, amount, status, installment_count, paid_at, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("credit_transactions")
          .select("id, amount, type, description, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      const assinaturas = regsResult.count ?? 0;
      const provasConcluidas = runsResult.count ?? 0;

      const payments: RunnerPayment[] = (paymentsResult.data || []).map((p) => ({
        id: p.id,
        plan_type: p.plan_type,
        plan_name: p.description || (p.plan_type === "anual" ? "RUNLAB CLUB" : "CHALLENGE TICKET"),
        billing_type: BILLING_TYPE_LABELS[p.billing_type] || p.billing_type,
        amount: Number(p.amount),
        status: p.status,
        installment_count: p.installment_count,
        paid_at: p.paid_at,
        created_at: p.created_at,
      }));

      const creditTransactions: CreditTransaction[] = (creditsResult.data || []).map((ct) => ({
        id: ct.id,
        amount: Number(ct.amount),
        type: ct.type,
        description: ct.description,
        created_at: ct.created_at,
      }));

      setData({
        id: row.id,
        name: (row.full_name as string) ?? "—",
        email: (row.email as string) ?? "—",
        phone: "—",
        birthDate: formatDate(row.birth_date as string | null),
        city: "—",
        state: "—",
        gender: (row.gender as string) ?? "—",
        modality: preferredToModality(row.preferred_distance as string | null),
        lastAccess: formatLastAccess(row.updated_at as string | null),
        level: 1,
        plan: derivePlanLabel(payments, Number(row.credit_balance) || 0),
        avatar: (row.avatar_url as string | null) ?? null,
        creditBalance: Number(row.credit_balance) || 0,
        stats: {
          provasConcluidas,
          assinaturas,
          distancia: "—",
        },
        payments,
        creditTransactions,
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Erro ao carregar corredor"));
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
