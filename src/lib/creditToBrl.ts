import { supabase } from "@/lib/supabase";

/**
 * Calcula o valor médio em BRL por crédito, cruzando
 * runner_payments (dinheiro real) com credit_transactions (créditos).
 *
 * Lógica: para cada credit_transaction do tipo "purchase" que tem payment_id,
 * busca o runner_payment.amount correspondente.
 * Taxa média = soma(runner_payments.amount) / soma(credit_transactions.amount)
 */
export async function fetchBrlPerCredit(): Promise<number> {
  const { data: purchases } = await supabase
    .from("credit_transactions")
    .select("amount, payment_id")
    .eq("type", "purchase")
    .not("payment_id", "is", null);

  if (!purchases?.length) return 0;

  const paymentIds = [...new Set(purchases.map((p) => p.payment_id!))];

  const { data: payments } = await supabase
    .from("runner_payments")
    .select("id, amount, status")
    .in("id", paymentIds)
    .in("status", ["CONFIRMED", "RECEIVED"]);

  if (!payments?.length) return 0;

  const paymentAmountMap: Record<string, number> = {};
  payments.forEach((p) => {
    paymentAmountMap[p.id] = Number(p.amount);
  });

  let totalBrl = 0;
  let totalCredits = 0;

  purchases.forEach((ct) => {
    const brl = paymentAmountMap[ct.payment_id!];
    if (brl !== undefined && ct.amount > 0) {
      totalBrl += brl;
      totalCredits += ct.amount;
    }
  });

  if (totalCredits === 0) return 0;
  return totalBrl / totalCredits;
}

/**
 * Busca todos os credit_transactions de tipo "usage" que têm
 * competition_registration_id, e retorna um mapa:
 *   competition_id → total de créditos consumidos (valor absoluto)
 *
 * Requer os registration_ids → competition_id mapping.
 */
export async function fetchCreditUsageByCompetition(): Promise<{
  usageByCompetition: Record<string, number>;
  usageByRegistration: Record<string, number>;
}> {
  const { data: usages } = await supabase
    .from("credit_transactions")
    .select("amount, competition_registration_id")
    .eq("type", "usage")
    .not("competition_registration_id", "is", null);

  if (!usages?.length) {
    return { usageByCompetition: {}, usageByRegistration: {} };
  }

  const regIds = [...new Set(usages.map((u) => u.competition_registration_id!))];

  const { data: regs } = await supabase
    .from("competition_registrations")
    .select("id, competition_id")
    .in("id", regIds);

  const regToComp: Record<string, string> = {};
  (regs ?? []).forEach((r) => {
    regToComp[r.id] = r.competition_id;
  });

  const usageByCompetition: Record<string, number> = {};
  const usageByRegistration: Record<string, number> = {};

  usages.forEach((u) => {
    const regId = u.competition_registration_id!;
    const credits = Math.abs(u.amount);
    usageByRegistration[regId] = (usageByRegistration[regId] ?? 0) + credits;

    const compId = regToComp[regId];
    if (compId) {
      usageByCompetition[compId] = (usageByCompetition[compId] ?? 0) + credits;
    }
  });

  return { usageByCompetition, usageByRegistration };
}
