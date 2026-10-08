import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlans } from "@/hooks/usePlans";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { formatCurrency } from "@/lib/formatCurrency";

const CUSTOM = "custom";

const GRANT_CREDITS_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Você não tem permissão para adicionar créditos.",
  TARGET_NOT_FOUND: "Usuário não encontrado.",
  INVALID_REASON: "Informe o motivo (até 300 caracteres).",
  PLAN_NOT_FOUND: "Plano não encontrado ou sem créditos.",
  INVALID_AMOUNT: "A quantidade deve ser entre 1 e 100.",
};

interface AdicionarCreditosButtonProps {
  userId: string;
  userName: string;
  onGranted?: () => void;
}

export const AdicionarCreditosButton = ({ userId, userName, onGranted }: AdicionarCreditosButtonProps) => {
  const { hasPermission } = usePermissions();
  const { plans } = usePlans();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [option, setOption] = useState<string>("");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");

  if (!hasPermission(PERMISSION_KEYS.FINANCEIRO_EDIT)) return null;

  const selectedPlan = plans.find((p) => p.id === option);
  const isCustom = option === CUSTOM;
  const parsedAmount = Number(amount);
  const creditsToGrant = selectedPlan ? selectedPlan.credits_amount : isCustom ? parsedAmount : 0;
  const amountValid = !isCustom || (Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 100);
  const canSubmit = !!option && amountValid && reason.trim().length > 0 && !saving;

  const reset = () => {
    setOption("");
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
      const { error } = await supabase.rpc("admin_grant_credits", {
        p_user_id: userId,
        p_reason: reason.trim(),
        p_plan_id: selectedPlan ? selectedPlan.id : null,
        p_amount: isCustom ? parsedAmount : null,
      });
      if (error) {
        throw new Error(GRANT_CREDITS_ERROR_MESSAGES[error.message] ?? "Não foi possível adicionar os créditos.");
      }

      toast.success("Créditos adicionados", {
        description: `+${creditsToGrant} crédito${creditsToGrant > 1 ? "s" : ""} para ${userName}.`,
      });
      setOpen(false);
      reset();
      onGranted?.();
    } catch (e) {
      toast.error("Erro ao adicionar créditos", {
        description: e instanceof Error ? e.message : "Não foi possível adicionar os créditos.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 border-0 hover:brightness-90 transition-all"
        style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
      >
        <Plus className="w-4 h-4" />
        Adicionar créditos
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
              <h2 className="text-2xl font-semibold text-foreground">Adicionar créditos</h2>
              <p className="text-sm text-muted-foreground">
                Concessão manual para <strong className="text-foreground">{userName}</strong>. Não gera
                cobrança nem aparece em Recebimentos.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={option} onValueChange={setOption} disabled={saving}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano ou quantidade" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} · {formatCurrency(plan.price)} · {plan.credits_amount} crédito
                      {plan.credits_amount > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>Quantidade personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <div className="space-y-2">
                <Label htmlFor="credits-amount">Quantidade de créditos</Label>
                <Input
                  id="credits-amount"
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={saving}
                />
                {!amountValid && (
                  <p className="text-xs text-destructive">Informe um número inteiro entre 1 e 100.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="credits-reason">Motivo</Label>
              <Textarea
                id="credits-reason"
                placeholder="Ex.: compra como convidado não vinculada (pay_xxx)"
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
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving
                  ? "Adicionando..."
                  : creditsToGrant > 0 && amountValid
                    ? `Adicionar ${creditsToGrant} crédito${creditsToGrant > 1 ? "s" : ""}`
                    : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
