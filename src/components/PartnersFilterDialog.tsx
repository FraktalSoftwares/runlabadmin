import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export type PartnersFilterValues = {
  status: string;
  type: string;
};

interface PartnersFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PartnersFilterValues;
  onApply: (filters: PartnersFilterValues) => void;
}

export const PartnersFilterDialog = ({ open, onOpenChange, filters, onApply }: PartnersFilterDialogProps) => {
  const [status, setStatus] = useState(filters.status);
  const [type, setType] = useState(filters.type);

  useEffect(() => {
    if (open) {
      setStatus(filters.status);
      setType(filters.type);
    }
  }, [open, filters.status, filters.type]);

  const handleApplyFilters = () => {
    onApply({ status, type });
    onOpenChange(false);
  };

  const handleClearFilters = () => {
    setStatus("");
    setType("");
    onApply({ status: "", type: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-0">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            Filtro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Status</Label>
            <div className="flex flex-wrap gap-2">
              {["Em analise", "Rejeitado", "Ativo", "Inativo"].map((statusOption) => (
                <Button
                  key={statusOption}
                  variant={status === statusOption ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus(status === statusOption ? "" : statusOption)}
                  className={
                    status === statusOption
                      ? "bg-success text-success-foreground"
                      : "bg-[#1A1A1A] text-foreground border-0"
                  }
                >
                  {statusOption}
                </Button>
              ))}
            </div>
          </div>

          {/* Tipo de parceiro */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">Tipo de parceiro</Label>
            <div className="flex flex-wrap gap-2">
              {["Assessoria", "Academia", "Treinador", "Individual", "Influenciador"].map((typeOption) => (
                <Button
                  key={typeOption}
                  variant={type === typeOption ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType(type === typeOption ? "" : typeOption)}
                  className={
                    type === typeOption
                      ? "bg-success text-success-foreground"
                      : "bg-[#1A1A1A] text-foreground border-0"
                  }
                >
                  {typeOption}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={handleApplyFilters}
            className="w-full bg-success text-success-foreground hover:bg-success/90"
          >
            Aplicar filtros
          </Button>
          <Button
            variant="secondary"
            onClick={handleClearFilters}
            className="w-full"
          >
            Limpar filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
