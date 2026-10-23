import { useState } from "react";
import { Minus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_KEYS } from "@/lib/permissions";

const REMOVE_CREDITS_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Você não tem permissão para remover créditos.",
  TARGET_NOT_FOUND: "Usuário não encontrado.",
  INVALID_REASON: "Informe o motivo (até 300 caracteres).",
  INVALID_AMOUNT: "A quantidade deve ser entre 1 e 100.",
  INSUFFICIENT_BALANCE: "O usuário não tem créditos suficientes para essa remoção.",
};

interface RemoverCreditosButtonProps {
  userId: string;
  userName: string;
  balance: number;
  onRemoved?: () => void;
}

export const RemoverCreditosButton = ({ userId, userName, balance, onRemoved }: RemoverCreditosButtonProps) => {
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");

  if (!hasPermission(PERMISSION_KEYS.FINANCEIRO_EDIT)) return null;

  const parsedAmount = Number(amount);
  const amountValid =
    Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= Math.min(100, balance);
  const canSubmit = amountValid && reason.trim().length > 0 && !saving;

  const reset = () => {
    setAmount("1");
    setReason("");
  };

  const handleOpenChange = (next: boolean) => {
    if (saving) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_remove_credits", {
        p_user_id: userId,
        p_amount: parsedAmount,
        p_reason: reason.trim(),
      });
      if (error) {
        throw new Error(REMOVE_CREDITS_ERROR_MESSAGES[error.message] ?? "Não foi possível remover os créditos.");
      }

      toast.success("Créditos removidos", {
        description: `-${parsedAmount} crédito${parsedAmount > 1 ? "s" : ""} de ${userName}.`,
      });
      setOpen(false);
      reset();
      onRemoved?.();
    } catch (e) {
      toast.error("Erro ao remover créditos", {
        description: e instanceof Error ? e.message : "Não foi possível remover os créditos.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={balance <= 0}
        title={balance <= 0 ? "Sem créditos para remover" : undefined}
        className="gap-2 border-0 hover:brightness-90 transition-all"
        style={{ backgroundColor: "#1A1A1A", color: "#EF4444" }}
      >
        <Minus className="w-4 h-4" />
        Remover créditos
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="bg-[#2a2a2a] border-0 sm:max-w-[500px] p-8">
          <button
            onClick={() => handleOpenChange(false)}
            disabled={saving}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Close</span>
          </button>

          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Remover créditos</h2>
              <p className="text-sm text-muted-foreground">
                Remoção manual de créditos de <strong className="text-foreground">{userName}</strong>. Saldo
                atual: <strong className="text-foreground">{balance}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remove-credits-amount">Quantidade a remover</Label>
              <Input
                id="remove-credits-amount"
                type="number"
                min={1}
                max={Math.min(100, balance)}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={saving}
              />
              {!amountValid && (
                <p className="text-xs text-destructive">
                  Informe um número inteiro entre 1 e {Math.min(100, balance)}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remove-credits-reason">Motivo</Label>
              <Textarea
                id="remove-credits-reason"
                placeholder="Ex.: crédito concedido por engano"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
                className="flex-1 bg-transparent border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!canSubmit}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {saving
                  ? "Removendo..."
                  : amountValid
                    ? `Remover ${parsedAmount} crédito${parsedAmount > 1 ? "s" : ""}`
                    : "Remover"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
