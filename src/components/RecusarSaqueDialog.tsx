import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { rejectWithdrawal, type RepasseRow } from "@/hooks/useRepasses";
import { toast } from "sonner";

interface RecusarSaqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repasse: RepasseRow | null;
  onDone: () => void;
}

const MAX_CHARS = 200;

export const RecusarSaqueDialog = ({
  open,
  onOpenChange,
  repasse,
  onDone,
}: RecusarSaqueDialogProps) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!repasse) return;
    setSubmitting(true);
    try {
      await rejectWithdrawal(repasse.id, reason.trim());
      toast.success("Solicitação recusada", { description: `Saque de ${repasse.nome} foi recusado.` });
      setReason("");
      onOpenChange(false);
      onDone();
    } catch {
      toast.error("Erro ao recusar");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#262626] border-0 sm:max-w-[500px] rounded-2xl p-8 gap-0">
        <div className="flex flex-col gap-8">
          <div className="pb-4 border-b border-[#4D4D4D]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-medium text-[#F5F5F5] leading-snug">
                Recusar solicitação de saque
              </DialogTitle>
              <DialogDescription className="text-sm text-[#808080] mt-1">
                Confirme abaixo o motivo da recusa. Essa informação será registrada e enviada ao parceiro.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#E0E0E0] mb-2">
                <span className="text-yellow-400 text-xs">★</span>
                Motivo da recusa
              </label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Ex: Solicitação suspeita, possível fraude"
                className="bg-[#1A1A1A] border-0 text-foreground placeholder:text-[#B2B2B2] min-h-[140px] resize-y rounded-lg"
                maxLength={MAX_CHARS}
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-[#4D4D4D]">
                  {reason.length}/{MAX_CHARS}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="ghost"
                className="flex-1 h-11 rounded-full bg-[#1A1A1A] text-[#B2B2B2] hover:bg-[#333] hover:text-foreground"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-11 rounded-full bg-[#FF3922] text-white hover:bg-[#FF3922]/90 font-medium"
                onClick={handleConfirm}
                disabled={submitting || !reason.trim()}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar recusa"
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
