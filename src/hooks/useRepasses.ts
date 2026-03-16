import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type RepasseStatus = "pago" | "em_processamento" | "erro" | "pendente" | "aprovado" | "rejeitado";

export interface PartnerBankInfo {
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  bank: string | null;
  agency: string | null;
  account: string | null;
  pixKey: string | null;
}

export interface RepasseRow {
  id: string;
  partnerId: string;
  nome: string;
  tipoParceiro: string;
  repasses: number;
  repassesFormatted: string;
  ultimoRepasse: string;
  status: RepasseStatus;
  requestedAt: string;
  reviewedAt: string | null;
  paidAt: string | null;
  adminNotes: string | null;
  bankInfo?: PartnerBankInfo;
}

function mapStatus(dbStatus: string): RepasseStatus {
  switch (dbStatus) {
    case "paid":
      return "pago";
    case "approved":
      return "em_processamento";
    case "rejected":
      return "rejeitado";
    case "pending":
      return "pendente";
    default:
      return "em_processamento";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

async function fetchRepasses(search?: string): Promise<RepasseRow[]> {
  const { data: requests, error } = await supabase
    .from("partner_withdrawal_requests")
    .select("id, partner_id, amount, status, requested_at, reviewed_at, paid_at, admin_notes")
    .order("requested_at", { ascending: false });

  if (error) throw error;
  if (!requests?.length) return [];

  const partnerIds = [...new Set(requests.map((r) => r.partner_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, cpf_cnpj, corporate_email, partner_phone, partner_bank, partner_agency, partner_account, partner_pix_key")
    .in("id", partnerIds);

  const { data: partnershipRequests } = await supabase
    .from("partnership_requests")
    .select("user_id, partner_type")
    .in("user_id", partnerIds);

  const nameByPartner: Record<string, string> = {};
  const bankByPartner: Record<string, PartnerBankInfo> = {};
  (profiles ?? []).forEach((p) => {
    nameByPartner[p.id] = p.full_name ?? "Parceiro";
    bankByPartner[p.id] = {
      cpfCnpj: p.cpf_cnpj ?? null,
      email: p.corporate_email ?? null,
      phone: p.partner_phone ?? null,
      bank: p.partner_bank ?? null,
      agency: p.partner_agency ?? null,
      account: p.partner_account ?? null,
      pixKey: p.partner_pix_key ?? null,
    };
  });

  const tipoByPartner: Record<string, string> = {};
  (partnershipRequests ?? []).forEach((pr) => {
    if (!tipoByPartner[pr.user_id]) {
      tipoByPartner[pr.user_id] = pr.partner_type ?? "Parceiro";
    }
  });

  const rows: RepasseRow[] = requests.map((r) => {
    const amount = Number(r.amount);
    return {
      id: r.id,
      partnerId: r.partner_id,
      nome: nameByPartner[r.partner_id] ?? "Parceiro",
      tipoParceiro: tipoByPartner[r.partner_id] ?? "Parceiro",
      repasses: amount,
      repassesFormatted: amount.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      ultimoRepasse: formatDate(r.requested_at),
      status: mapStatus(r.status),
      requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at ?? null,
      paidAt: r.paid_at ?? null,
      adminNotes: r.admin_notes ?? null,
      bankInfo: bankByPartner[r.partner_id],
    };
  });

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.tipoParceiro.toLowerCase().includes(q),
    );
  }

  return rows;
}

export function useRepasses(search?: string) {
  return useQuery({
    queryKey: ["financeiro-repasses", search],
    queryFn: () => fetchRepasses(search),
  });
}

async function fetchPendingWithdrawalsCount(): Promise<number> {
  const { count, error } = await supabase
    .from("partner_withdrawal_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export function usePendingWithdrawalsCount() {
  return useQuery({
    queryKey: ["pending-withdrawals-count"],
    queryFn: fetchPendingWithdrawalsCount,
  });
}

export async function fetchPendingWithdrawals(): Promise<RepasseRow[]> {
  const { data: requests, error } = await supabase
    .from("partner_withdrawal_requests")
    .select("id, partner_id, amount, status, requested_at, reviewed_at, paid_at, admin_notes")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) throw error;
  if (!requests?.length) return [];

  const partnerIds = [...new Set(requests.map((r) => r.partner_id))];

  const [{ data: profiles }, { data: partnershipReqs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, cpf_cnpj, corporate_email, partner_phone, partner_bank, partner_agency, partner_account, partner_pix_key").in("id", partnerIds),
    supabase.from("partnership_requests").select("user_id, partner_type, email, phone").in("user_id", partnerIds),
  ]);

  const nameByPartner: Record<string, string> = {};
  const bankByPartner: Record<string, PartnerBankInfo> = {};
  const emailByPartner: Record<string, string | null> = {};
  const phoneByPartner: Record<string, string | null> = {};
  (profiles ?? []).forEach((p) => {
    nameByPartner[p.id] = p.full_name ?? "Parceiro";
    emailByPartner[p.id] = p.corporate_email ?? null;
    phoneByPartner[p.id] = p.partner_phone ?? null;
    bankByPartner[p.id] = {
      cpfCnpj: p.cpf_cnpj ?? null,
      email: p.corporate_email ?? null,
      phone: p.partner_phone ?? null,
      bank: p.partner_bank ?? null,
      agency: p.partner_agency ?? null,
      account: p.partner_account ?? null,
      pixKey: p.partner_pix_key ?? null,
    };
  });

  const tipoByPartner: Record<string, string> = {};
  (partnershipReqs ?? []).forEach((pr) => {
    if (!tipoByPartner[pr.user_id]) tipoByPartner[pr.user_id] = pr.partner_type ?? "Parceiro";
  });

  return requests.map((r) => {
    const amount = Number(r.amount);
    return {
      id: r.id,
      partnerId: r.partner_id,
      nome: nameByPartner[r.partner_id] ?? "Parceiro",
      tipoParceiro: tipoByPartner[r.partner_id] ?? "Parceiro",
      repasses: amount,
      repassesFormatted: amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }),
      ultimoRepasse: formatDate(r.requested_at),
      status: mapStatus(r.status),
      requestedAt: r.requested_at,
      reviewedAt: r.reviewed_at ?? null,
      paidAt: r.paid_at ?? null,
      adminNotes: r.admin_notes ?? null,
      bankInfo: bankByPartner[r.partner_id],
    };
  });
}

export function usePendingWithdrawals() {
  return useQuery({
    queryKey: ["pending-withdrawals"],
    queryFn: fetchPendingWithdrawals,
  });
}

export async function approveWithdrawal(id: string) {
  const { data, error } = await supabase
    .from("partner_withdrawal_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("partner_id, amount")
    .single();
  if (error) throw error;

  const valor = Number(data.amount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  await supabase.from("notifications").insert({
    user_id: data.partner_id,
    type: "maintenance",
    title: "Saque aprovado",
    description: `Seu saque de ${valor} foi aprovado! O valor será depositado na sua conta cadastrada em até 5 dias úteis.`,
  });
}

export async function markWithdrawalAsPaid(id: string) {
  const { data, error } = await supabase
    .from("partner_withdrawal_requests")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id)
    .select("partner_id, amount")
    .single();
  if (error) throw error;

  const valor = Number(data.amount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  await supabase.from("notifications").insert({
    user_id: data.partner_id,
    type: "maintenance",
    title: "Saque depositado",
    description: `Seu saque de ${valor} foi depositado na sua conta cadastrada. Confira seu extrato bancário.`,
  });
}

export async function rejectWithdrawal(id: string, adminNotes: string) {
  const { data, error } = await supabase
    .from("partner_withdrawal_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), admin_notes: adminNotes })
    .eq("id", id)
    .select("partner_id, amount")
    .single();
  if (error) throw error;

  const valor = Number(data.amount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  await supabase.from("notifications").insert({
    user_id: data.partner_id,
    type: "maintenance",
    title: "Saque recusado",
    description: `Sua solicitação de saque de ${valor} foi recusada. Motivo: ${adminNotes}`,
  });
}

// Comissões do parceiro para o dialog de detalhes
export interface PartnerCommissionItem {
  id: string;
  data: string;
  competicao: string;
  valor: string;
  valorNum: number;
}

export async function fetchPartnerCommissions(
  partnerId: string,
): Promise<PartnerCommissionItem[]> {
  const { data: commissions, error } = await supabase
    .from("partner_commissions")
    .select("id, payment_id, commission_amount, created_at")
    .eq("partner_id", partnerId)
    .in("status", ["pending", "confirmed"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  if (!commissions?.length) return [];

  const paymentIds = [...new Set(commissions.map((c) => c.payment_id).filter(Boolean))];
  const descriptionByPayment: Record<string, string> = {};

  if (paymentIds.length > 0) {
    const { data: payments } = await supabase
      .from("runner_payments")
      .select("id, description")
      .in("id", paymentIds);
    (payments ?? []).forEach((p) => {
      descriptionByPayment[p.id] = p.description ?? "Comissão";
    });
  }

  return commissions.map((c) => {
    const valorNum = Number(c.commission_amount);
    return {
      id: c.id,
      data: formatDate(c.created_at),
      competicao: descriptionByPayment[c.payment_id] ?? "Comissão",
      valor: valorNum.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      valorNum,
    };
  });
}

export function usePartnerCommissions(partnerId: string | null) {
  return useQuery({
    queryKey: ["partner-commissions", partnerId],
    queryFn: () => fetchPartnerCommissions(partnerId!),
    enabled: !!partnerId,
  });
}
