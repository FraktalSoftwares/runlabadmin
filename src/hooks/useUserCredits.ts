import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtimeRefetch } from "./useSupabaseRealtime";

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: "purchase" | "usage" | "refund" | "expiration" | "admin_adjustment";
  description: string | null;
  payment_id: string | null;
  competition_registration_id: string | null;
  created_at: string;
}

export interface CreditBalance {
  balance: number;
  total_earned: number;
  total_spent: number;
}

export function useUserCredits(userId?: string) {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    if (!userId) {
      setBalance(null);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [balanceResult, transactionsResult] = await Promise.all([
        supabase
          .from("user_credit_balances")
          .select("balance, total_earned, total_spent")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("credit_transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      if (balanceResult.error) {
        console.error("Error fetching credit balance:", balanceResult.error);
      }

      if (transactionsResult.error) {
        console.error("Error fetching credit transactions:", transactionsResult.error);
        setError(transactionsResult.error.message);
      }

      setBalance(
        balanceResult.data
          ? {
              balance: Number(balanceResult.data.balance),
              total_earned: Number(balanceResult.data.total_earned),
              total_spent: Number(balanceResult.data.total_spent),
            }
          : { balance: 0, total_earned: 0, total_spent: 0 }
      );

      setTransactions(
        (transactionsResult.data || []).map((row) => ({
          ...row,
          amount: Number(row.amount),
        }))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar créditos";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useRealtimeRefetch(["credit_transactions", "user_credit_balances"], fetchCredits);

  return { balance, transactions, loading, error, refetch: fetchCredits };
}

export function formatTransactionType(type: CreditTransaction["type"]): string {
  const map: Record<CreditTransaction["type"], string> = {
    purchase: "Compra",
    usage: "Uso em desafio",
    refund: "Reembolso",
    expiration: "Expiração",
    admin_adjustment: "Ajuste administrativo",
  };
  return map[type] || type;
}
