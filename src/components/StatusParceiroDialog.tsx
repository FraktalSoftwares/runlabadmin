import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface InativarParceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  parceiroNome?: string;
}

export const InativarParceiroDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  parceiroNome 
}: InativarParceiroDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#2a2a2a] border-0 sm:max-w-[500px] p-8">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
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
              Deseja inativar parceiro?
            </h2>
            <p className="text-base text-foreground">
              Tem certeza de que deseja inativar este parceiro?
            </p>
            <p className="text-sm text-muted-foreground">
              Essa ação não pode ser desfeita.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-transparent border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                await onConfirm();
              }}
              className="flex-1 bg-muted-foreground/70 text-foreground hover:bg-muted-foreground/90"
            >
              Inativar parceiro
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
