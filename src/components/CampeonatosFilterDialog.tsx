import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

interface CampeonatosFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CampeonatosFilterDialog = ({ open, onOpenChange }: CampeonatosFilterDialogProps) => {
  const [status, setStatus] = useState<string>("finalizada");
  const [periodo, setPeriodo] = useState<string>("outro");
  const [customPeriodo, setCustomPeriodo] = useState("");
  const [tipoRanking, setTipoRanking] = useState<string>("ranking_etapa");
  const handleApplyFilters = () => {
    toast.success("Filtros aplicados", { description: "Os filtros foram aplicados com sucesso." });
    onOpenChange(false);
  };

  const handleClearFilters = () => {
    setStatus("");
    setPeriodo("");
    setCustomPeriodo("");
    setTipoRanking("");
    toast.info("Filtros limpos", { description: "Todos os filtros foram removidos." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-0 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Filtro</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Status da competição */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Status da competição</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => setStatus("aberta")}
                className={`${
                  status === "aberta"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Aberta
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStatus("em_andamento")}
                className={`${
                  status === "em_andamento"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Em andamento
              </Button>
              <Button
                variant="ghost"
                onClick={() => setStatus("finalizada")}
                className={`${
                  status === "finalizada"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Finalizada
              </Button>
            </div>
          </div>

          {/* Período */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Período</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                variant="ghost"
                onClick={() => setPeriodo("30dias")}
                className={`${
                  periodo === "30dias"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Últimos 30 dias
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPeriodo("6meses")}
                className={`${
                  periodo === "6meses"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Últimos 6 meses
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPeriodo("ano")}
                className={`${
                  periodo === "ano"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Último ano
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPeriodo("outro")}
                className={`${
                  periodo === "outro"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Outro
              </Button>
            </div>
            <Input
              placeholder="Insira outro período"
              value={customPeriodo}
              onChange={(e) => setCustomPeriodo(e.target.value)}
              className="bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Tipo de ranking */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Tipo de ranking</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => setTipoRanking("ranking_geral")}
                className={`${
                  tipoRanking === "ranking_geral"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Ranking geral
              </Button>
              <Button
                variant="ghost"
                onClick={() => setTipoRanking("ranking_etapa")}
                className={`${
                  tipoRanking === "ranking_etapa"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Ranking por etapa
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleApplyFilters}
            className="w-full bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90 font-medium"
          >
            Aplicar filtros
          </Button>
          <button
            onClick={handleClearFilters}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};