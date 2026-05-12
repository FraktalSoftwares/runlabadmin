import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Landmark, Copy, User, Mail, Phone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RepasseRow, RepasseStatus } from "@/hooks/useRepasses";
import { usePartnerCommissions, markWithdrawalAsPaid } from "@/hooks/useRepasses";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface RepasseDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repasse: RepasseRow | null;
}

function StatusBadge({ status }: { status: RepasseStatus }) {
  const config: Record<RepasseStatus, { bg: string; text: string; label: string }> = {
    pendente: { bg: "bg-[#FEE59A]", text: "text-[#654C01]", label: "Saque solicitado" },
    em_processamento: { bg: "bg-[#C5CCD3]", text: "text-[#2C333A]", label: "Processando" },
    aprovado: { bg: "bg-[#C5CCD3]", text: "text-[#2C333A]", label: "Processando" },
    pago: { bg: "bg-[#B0E8D1]", text: "text-[#174F38]", label: "Pago" },
    erro: { bg: "bg-[#EEAFAA]", text: "text-[#551611]", label: "Erro" },
    rejeitado: { bg: "bg-[#EEAFAA]", text: "text-[#551611]", label: "Rejeitado" },
    sem_solicitacao: { bg: "bg-[#3A3A3A]", text: "text-[#B2B2B2]", label: "Sem saque pedido" },
  };
  const c = config[status] ?? config.em_processamento;
  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm w-[136px] ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

const isProcessing = (status: RepasseStatus) =>
  status === "em_processamento" || status === "aprovado";

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.info("Copiado!", { description: text });
}

interface PartnerProfile {
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  bank: string | null;
  agency: string | null;
  account: string | null;
  pixKey: string | null;
}

async function fetchPartnerProfile(partnerId: string): Promise<PartnerProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("cpf_cnpj, corporate_email, partner_phone, partner_bank, partner_agency, partner_account, partner_pix_key")
    .eq("id", partnerId)
    .single();
  if (error) throw error;
  return {
    cpfCnpj: data.cpf_cnpj ?? null,
    email: data.corporate_email ?? null,
    phone: data.partner_phone ?? null,
    bank: data.partner_bank ?? null,
    agency: data.partner_agency ?? null,
    account: data.partner_account ?? null,
    pixKey: data.partner_pix_key ?? null,
  };
}

function usePartnerProfile(partnerId: string | null) {
  return useQuery({
    queryKey: ["partner-profile-bank", partnerId],
    queryFn: () => fetchPartnerProfile(partnerId!),
    enabled: !!partnerId,
  });
}

function PartnerBankBlock({ partnerId }: { partnerId: string | null }) {
  const { data: profile } = usePartnerProfile(partnerId);
  if (!profile) return null;

  const hasBank = profile.bank || profile.agency || profile.account || profile.pixKey;
  const hasContact = profile.cpfCnpj || profile.email || profile.phone;
  if (!hasBank && !hasContact) return null;

  return (
    <div className="flex flex-col gap-2 bg-[#1A1A1A] rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <Landmark className="h-3.5 w-3.5 text-[#808080] shrink-0" />
        <span className="text-xs font-semibold text-[#808080]">Dados de pagamento</span>
      </div>
      {hasBank && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {profile.bank && (
            <span className="text-xs text-[#B2B2B2]">
              Banco <span className="text-[#E0E0E0] font-medium">{profile.bank}</span>
            </span>
          )}
          {profile.agency && (
            <span className="text-xs text-[#B2B2B2]">
              Ag <span className="text-[#E0E0E0] font-medium">{profile.agency}</span>
            </span>
          )}
          {profile.account && (
            <span className="text-xs text-[#B2B2B2]">
              Conta <span className="text-[#E0E0E0] font-medium">{profile.account}</span>
            </span>
          )}
          {profile.pixKey && (
            <button
              onClick={() => copyToClipboard(profile.pixKey!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              Pix <span className="text-[#CCF725] font-medium">{profile.pixKey}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
        </div>
      )}
      {hasContact && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {profile.cpfCnpj && (
            <button
              onClick={() => copyToClipboard(profile.cpfCnpj!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              <User className="h-3.5 w-3.5 text-[#808080] shrink-0" />
              CPF/CNPJ <span className="text-[#E0E0E0] font-medium">{profile.cpfCnpj}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
          {profile.email && (
            <button
              onClick={() => copyToClipboard(profile.email!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-[#808080] shrink-0" />
              <span className="text-[#E0E0E0] font-medium">{profile.email}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
          {profile.phone && (
            <button
              onClick={() => copyToClipboard(profile.phone!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-[#808080] shrink-0" />
              <span className="text-[#E0E0E0] font-medium">{profile.phone}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const RepasseDetailsDialog = ({
  open,
  onOpenChange,
  repasse,
}: RepasseDetailsDialogProps) => {
  const { data: comissoes = [], isLoading: loadingComissoes } = usePartnerCommissions(
    repasse?.partnerId ?? null,
  );
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const handleConfirmPayment = async () => {
    if (!repasse) return;
    setConfirming(true);
    try {
      await markWithdrawalAsPaid(repasse.id);
      toast.success("Pagamento confirmado", { description: `Repasse de ${repasse.repassesFormatted} para ${repasse.nome} marcado como pago.` });
      queryClient.invalidateQueries({ queryKey: ["financeiro-repasses"] });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawals-count"] });
      onOpenChange(false);
    } catch {
      toast.error("Erro ao confirmar pagamento");
    } finally {
      setConfirming(false);
    }
  };

  if (!repasse) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#262626] border border-[#4D4D4D] sm:max-w-[700px] rounded-2xl p-0 gap-0">
        <div className="flex flex-col gap-4 px-4 py-8">
          <StatusBadge status={repasse.status} />
          <DialogHeader>
            <DialogTitle className="text-xl font-medium text-[#F5F5F5]">
              {repasse.nome}{" "}
              <span className="text-[#808080] font-normal">• {repasse.tipoParceiro}</span>
            </DialogTitle>
          </DialogHeader>

          <PartnerBankBlock partnerId={repasse.partnerId} />

          {repasse.status === "rejeitado" && repasse.adminNotes && (
            <div className="flex flex-col gap-1 bg-[#EEAFAA]/10 border border-[#EEAFAA]/30 rounded-lg px-4 py-3">
              <span className="text-xs font-semibold text-[#EEAFAA]">Motivo da recusa</span>
              <p className="text-sm text-[#E0E0E0]">{repasse.adminNotes}</p>
            </div>
          )}

          {loadingComissoes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comissoes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhuma comissão encontrada para este parceiro.
            </p>
          ) : (
            <div className="flex flex-col">
              {comissoes.map((comissao) => (
                <div
                  key={comissao.id}
                  className="flex items-center justify-between py-3 border-b border-[#4D4D4D] last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-xs text-[#B2B2B2]">{comissao.data}</p>
                    <p className="text-sm text-[#F5F5F5]">{comissao.competicao}</p>
                  </div>
                  <p className="text-sm text-[#F5F5F5] text-right flex-1">
                    {comissao.valor}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between bg-[#1A1A1A] px-4 py-3 rounded-lg">
            <span className="text-base text-[#CCF725] font-medium">Total de comissões:</span>
            <span className="text-lg text-[#CCF725] font-bold">
              {repasse.repassesFormatted}
            </span>
          </div>

          {isProcessing(repasse.status) && (
            <Button
              onClick={handleConfirmPayment}
              disabled={confirming}
              className="w-full h-11 rounded-full bg-[#CCF725] text-black hover:bg-[#CCF725]/90 font-medium"
            >
              {confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar pagamento realizado
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
