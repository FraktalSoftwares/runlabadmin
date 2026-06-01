import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X } from "lucide-react";

interface EditarCupomParceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCode: string | null;
  parceiroNome?: string;
  onConfirm: (newCode: string) => Promise<void>;
}

const CODE_REGEX = /^[A-Z0-9_-]{3,20}$/;

export const EditarCupomParceiroDialog = ({
  open,
  onOpenChange,
  currentCode,
  parceiroNome,
  onConfirm,
}: EditarCupomParceiroDialogProps) => {
  const [value, setValue] = useState(currentCode ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentCode ?? "");
      setError(null);
      setSaving(false);
    }
  }, [open, currentCode]);

  const normalized = value.trim().toUpperCase();
  const unchanged = normalized === (currentCode ?? "").toUpperCase();
  const isValid = CODE_REGEX.test(normalized);

  const handleSave = async () => {
    if (!isValid) {
      setError("Use 3 a 20 caracteres: letras, números, _ ou -.");
      return;
    }
    if (unchanged) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar o cupom.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a2a2a] border-0 sm:max-w-[500px] p-8">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Fechar</span>
        </button>

        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              Editar cupom do parceiro
            </h2>
            {parceiroNome && (
              <p className="text-sm text-muted-foreground">{parceiroNome}</p>
            )}
            <p className="text-sm text-muted-foreground">
              O código é convertido em maiúsculas e deve ser único no sistema.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              Novo cupom
            </label>
            <Input
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex.: PARCEIRO10"
              maxLength={20}
              className="bg-[#1A1A1A] border-0 text-foreground uppercase tracking-wider"
              style={{ textTransform: "uppercase" }}
              disabled={saving}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 bg-transparent border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !isValid || unchanged}
              className="flex-1 border-0 hover:brightness-90 transition-all"
              style={{ backgroundColor: "#CCF725", color: "#1A1A1A" }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
