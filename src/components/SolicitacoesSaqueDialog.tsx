import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Landmark, Copy, User, Mail, Phone } from "lucide-react";
import { usePendingWithdrawals, approveWithdrawal, type RepasseRow, type PartnerBankInfo } from "@/hooks/useRepasses";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { RecusarSaqueDialog } from "@/components/RecusarSaqueDialog";
import { formatCurrency } from "@/lib/formatCurrency";

interface SolicitacoesSaqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast({ title: "Copiado!", description: text });
}

function BankInfoRow({ bankInfo }: { bankInfo: PartnerBankInfo }) {
  const hasBank = bankInfo.bank || bankInfo.agency || bankInfo.account || bankInfo.pixKey;
  const hasContact = bankInfo.cpfCnpj || bankInfo.email || bankInfo.phone;
  if (!hasBank && !hasContact) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {hasBank && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-[#1A1A1A] rounded-lg px-3 py-2.5">
          <Landmark className="h-3.5 w-3.5 text-[#808080] shrink-0" />
          {bankInfo.bank && (
            <span className="text-xs text-[#B2B2B2]">
              Banco <span className="text-[#E0E0E0] font-medium">{bankInfo.bank}</span>
            </span>
          )}
          {bankInfo.agency && (
            <span className="text-xs text-[#B2B2B2]">
              Ag <span className="text-[#E0E0E0] font-medium">{bankInfo.agency}</span>
            </span>
          )}
          {bankInfo.account && (
            <span className="text-xs text-[#B2B2B2]">
              Conta <span className="text-[#E0E0E0] font-medium">{bankInfo.account}</span>
            </span>
          )}
          {bankInfo.pixKey && (
            <button
              onClick={() => copyToClipboard(bankInfo.pixKey!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              Pix <span className="text-[#CCF725] font-medium">{bankInfo.pixKey}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
        </div>
      )}
      {hasContact && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-[#1A1A1A] rounded-lg px-3 py-2.5">
          {bankInfo.cpfCnpj && (
            <button
              onClick={() => copyToClipboard(bankInfo.cpfCnpj!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              <User className="h-3.5 w-3.5 text-[#808080] shrink-0" />
              CPF/CNPJ <span className="text-[#E0E0E0] font-medium">{bankInfo.cpfCnpj}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
          {bankInfo.email && (
            <button
              onClick={() => copyToClipboard(bankInfo.email!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              <Mail className="h-3.5 w-3.5 text-[#808080] shrink-0" />
              <span className="text-[#E0E0E0] font-medium">{bankInfo.email}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
          {bankInfo.phone && (
            <button
              onClick={() => copyToClipboard(bankInfo.phone!)}
              className="flex items-center gap-1 text-xs text-[#B2B2B2] hover:text-[#E0E0E0] transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-[#808080] shrink-0" />
              <span className="text-[#E0E0E0] font-medium">{bankInfo.phone}</span>
              <Copy className="h-3 w-3 text-[#808080]" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const SolicitacoesSaqueDialog = ({ open, onOpenChange }: SolicitacoesSaqueDialogProps) => {
  const { data: pendingRows = [], isLoading } = usePendingWithdrawals();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RepasseRow | null>(null);

  const totalSolicitado = pendingRows.reduce((acc, r) => acc + r.repasses, 0);

  const handleApprove = async (row: RepasseRow) => {
    setProcessing(row.id);
    try {
      await approveWithdrawal(row.id);
      toast({ title: "Saque aprovado", description: `Saque de ${row.nome} aprovado.` });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["pending-withdrawals-count"] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-repasses"] });
    } catch {
      toast({ title: "Erro ao aprovar", variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectDone = () => {
    setRejectTarget(null);
    queryClient.invalidateQueries({ queryKey: ["pending-withdrawals"] });
    queryClient.invalidateQueries({ queryKey: ["pending-withdrawals-count"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro-repasses"] });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#262626] border border-[#4D4D4D] sm:max-w-[700px] rounded-2xl p-0 gap-0">
          <div className="flex flex-col gap-4 px-4 py-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium text-[#F5F5F5]">
              Solicitações de saque
            </DialogTitle>
          </DialogHeader>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : pendingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma solicitação pendente.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {pendingRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 pb-4 border-b border-[#4D4D4D]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm text-[#F5F5F5]">
                          {row.nome} • {row.tipoParceiro}
                        </span>
                        <div className="flex items-end gap-1">
                          <span className="text-base text-[#CCF725] font-medium">
                            {row.repassesFormatted}
                          </span>
                          <span className="text-xs text-[#B2B2B2] pb-px">
                            solicitado em {row.ultimoRepasse}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-[26px] rounded-full bg-[#1A1A1A] text-[#B2B2B2] hover:bg-[#333] hover:text-foreground px-4 text-sm"
                          onClick={() => setRejectTarget(row)}
                          disabled={processing === row.id}
                        >
                          Recusar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-[26px] rounded-full border-[#CCF725] text-[#CCF725] bg-transparent hover:bg-[#CCF725]/10 px-4 text-sm"
                          onClick={() => handleApprove(row)}
                          disabled={!!processing}
                        >
                          {processing === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            "Aceitar"
                          )}
                        </Button>
                      </div>
                    </div>
                    {row.bankInfo && <BankInfoRow bankInfo={row.bankInfo} />}
                  </div>
                ))}
              </div>
            )}

            {pendingRows.length > 0 && (
              <div className="flex items-center justify-between bg-[#1A1A1A] px-4 py-3 rounded-lg mt-2">
                <span className="text-base text-[#CCF725] font-medium">Total solicitado:</span>
                <span className="text-lg text-[#CCF725] font-bold">
                  {formatCurrency(totalSolicitado)}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RecusarSaqueDialog
        open={!!rejectTarget}
        onOpenChange={(open) => { if (!open) setRejectTarget(null); }}
        repasse={rejectTarget}
        onDone={handleRejectDone}
      />
    </>
  );
};
