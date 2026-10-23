import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface StatusParceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  /** Status atual do parceiro: true = ativo (a ação será inativar). */
  isActive: boolean;
  parceiroNome?: string;
}

export const StatusParceiroDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isActive,
  parceiroNome,
}: StatusParceiroDialogProps) => {
  const [saving, setSaving] = useState(false);
  const nome = parceiroNome ?? "este parceiro";

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="bg-[#2a2a2a] border-0 sm:max-w-[500px] p-8">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          disabled={saving}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        >
          <X className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Close</span>
        </button>

        {/* Content */}
        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              {isActive ? "Deseja inativar parceiro?" : "Deseja ativar parceiro?"}
            </h2>
            <p className="text-base text-foreground">
              {isActive
                ? `Ao inativar ${nome}, o código de indicação deixa de ser aceito no checkout.`
                : `Ao ativar ${nome}, o código de indicação volta a ser aceito no checkout.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {isActive
                ? "Você pode ativar o parceiro novamente quando quiser."
                : "A parceria passa a valer a partir de hoje, sem data de término."}
            </p>
          </div>

          {/* Actions */}
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
              onClick={async () => {
                setSaving(true);
                try {
                  await onConfirm();
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className={
                isActive
                  ? "flex-1 bg-muted-foreground/70 text-foreground hover:bg-muted-foreground/90"
                  : "flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              }
            >
              {saving
                ? isActive ? "Inativando..." : "Ativando..."
                : isActive ? "Inativar parceiro" : "Ativar parceiro"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
