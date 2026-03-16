import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, called instead of the default toast-only behavior */
  onExport?: (format: string) => void | Promise<void>;
  /** Shows a loading spinner on the export button */
  exporting?: boolean;
}

export const ExportDialog = ({
  open,
  onOpenChange,
  onExport,
  exporting = false,
}: ExportDialogProps) => {
  const [exportFormat, setExportFormat] = useState("csv");

  const handleExport = async () => {
    if (onExport) {
      await onExport(exportFormat);
    } else {
      toast.info("Exportação iniciada", { description: `Exportando dados em formato ${exportFormat.toUpperCase()}...` });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-0 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Exportar</DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <RadioGroup value={exportFormat} onValueChange={setExportFormat}>
            <div className="flex items-center space-x-3">
              <RadioGroupItem value="csv" id="csv" className="border-muted-foreground" />
              <Label htmlFor="csv" className="text-foreground cursor-pointer">
                Exportar em CSV
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
            disabled={exporting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            className="flex-1 bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90 font-medium"
            disabled={exporting}
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Exportando...
              </>
            ) : (
              "Exportar"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
