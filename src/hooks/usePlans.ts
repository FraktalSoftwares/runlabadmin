import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface Plan {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  type: "avulsa" | "anual";
  price: number;
  installments_count: number;
  installment_value: number | null;
  features: string[];
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
}

export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlans() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (cancelled) return;

      if (fetchError) {
        console.error("Error fetching plans:", fetchError);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const parsed: Plan[] = (data || []).map((row) => ({
        ...row,
        price: Number(row.price),
        installment_value: row.installment_value
          ? Number(row.installment_value)
          : null,
      }));

      setPlans(parsed);
      setLoading(false);
    }

    fetchPlans();

    return () => {
      cancelled = true;
    };
  }, []);

  return { plans, loading, error };
}

export function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
