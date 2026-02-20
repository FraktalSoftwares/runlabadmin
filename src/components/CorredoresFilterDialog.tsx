import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCorredoresFilters } from "@/contexts/CorredoresFilterContext";
import type { CorredorFilters } from "@/hooks/useCorredores";

interface CorredoresFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function participacaoToMin(value: string, customValue?: number): number | undefined {
  switch (value) {
    case "nenhuma": return 0;
    case "1-3": return 1;
    case "4-10": return 4;
    case "10+": return 10;
    case "outro": return customValue != null && customValue >= 0 ? customValue : undefined;
    default: return undefined;
  }
}

export const CorredoresFilterDialog = ({ open, onOpenChange }: CorredoresFilterDialogProps) => {
  const { filters, setFilters, clearFilters } = useCorredoresFilters();
  const [plano, setPlano] = useState<string>("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [distancia, setDistancia] = useState<string>("");
  const [customDistancia, setCustomDistancia] = useState("");
  const [participacao, setParticipacao] = useState<string>("");
  const [customParticipacao, setCustomParticipacao] = useState<string>("");
  const [eParceiro, setEParceiro] = useState(false);
  const [naoEParceiro, setNaoEParceiro] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setPlano(
        filters.plano === "Gratuito" ? "gratuito" : filters.plano === "ComCreditos" ? "com_creditos" : ""
      );
      setCidade(filters.cidade ?? "");
      setEstado(filters.estado ?? "");
      setDistancia(
        filters.preferredDistance
          ? ["3km", "5km", "10km", "21km", "42km"].includes(filters.preferredDistance)
            ? filters.preferredDistance
            : "outro"
          : ""
      );
      setCustomDistancia(
        filters.preferredDistance && !["3km", "5km", "10km", "21km", "42km"].includes(filters.preferredDistance)
          ? filters.preferredDistance
          : ""
      );
      const pMin = filters.participacaoMin;
      if (pMin == null) setParticipacao("");
      else if (pMin === 0) setParticipacao("nenhuma");
      else if (pMin === 1) setParticipacao("1-3");
      else if (pMin === 4) setParticipacao("4-10");
      else if (pMin === 10) setParticipacao("10+");
      else {
        setParticipacao("outro");
        setCustomParticipacao(String(pMin));
      }
      setEParceiro(filters.eParceiro ?? false);
      setNaoEParceiro(filters.naoEParceiro ?? false);
    }
  }, [
    open,
    filters.plano,
    filters.cidade,
    filters.estado,
    filters.preferredDistance,
    filters.participacaoMin,
    filters.eParceiro,
    filters.naoEParceiro,
  ]);

  const handleApplyFilters = () => {
    const planoValue = plano === "gratuito" ? "Gratuito" : plano === "com_creditos" ? "ComCreditos" : undefined;
    const participacaoMinValue = participacao
      ? participacaoToMin(
          participacao,
          participacao === "outro" ? parseInt(customParticipacao, 10) : undefined
        )
      : undefined;
    const newFilters: CorredorFilters = {
      ...filters,
      plano: planoValue,
      cidade: cidade?.trim() || undefined,
      estado: estado?.trim() || undefined,
      eParceiro: eParceiro ? true : undefined,
      naoEParceiro: naoEParceiro ? true : undefined,
      preferredDistance: distancia ? (distancia === "outro" ? customDistancia?.trim() || undefined : distancia) : undefined,
      participacaoMin: participacaoMinValue,
    };
    setFilters(newFilters);
    toast({
      title: "Filtros aplicados",
      description: "Os filtros foram aplicados com sucesso.",
    });
    onOpenChange(false);
  };

  const handleClearFilters = () => {
    setPlano("");
    setCidade("");
    setEstado("");
    setDistancia("");
    setCustomDistancia("");
    setParticipacao("");
    setCustomParticipacao("");
    setEParceiro(false);
    setNaoEParceiro(false);
    clearFilters();
    toast({
      title: "Filtros limpos",
      description: "Todos os filtros foram removidos.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-0 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Filtro</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Plano: Gratuito ou com créditos */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Plano</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => setPlano(plano === "gratuito" ? "" : "gratuito")}
                className={`${
                  plano === "gratuito"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Gratuito
              </Button>
              <Button
                variant="ghost"
                onClick={() => setPlano(plano === "com_creditos" ? "" : "com_creditos")}
                className={`${
                  plano === "com_creditos"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Com créditos
              </Button>
            </div>
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Cidade</h3>
              <Input
                placeholder="Ex: São Paulo"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Estado</h3>
              <Input
                placeholder="Ex: SP"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Última distância corrida */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Última distância corrida</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button
                variant="ghost"
                onClick={() => setDistancia("3km")}
                className={`${
                  distancia === "3km"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                3 km
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDistancia("5km")}
                className={`${
                  distancia === "5km"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                5 km
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDistancia("10km")}
                className={`${
                  distancia === "10km"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                10 km
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDistancia("21km")}
                className={`${
                  distancia === "21km"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                21 km
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDistancia("42km")}
                className={`${
                  distancia === "42km"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                42 km
              </Button>
              <Button
                variant="ghost"
                onClick={() => setDistancia("outro")}
                className={`${
                  distancia === "outro"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Outro
              </Button>
            </div>
            {distancia === "outro" && (
              <Input
                placeholder="Insira outra distância percorrida"
                value={customDistancia}
                onChange={(e) => setCustomDistancia(e.target.value)}
                className="mt-2 bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            )}
          </div>

          {/* Participação em provas */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Participação em provas</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => setParticipacao("nenhuma")}
                className={`${
                  participacao === "nenhuma"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Nenhuma
              </Button>
              <Button
                variant="ghost"
                onClick={() => setParticipacao("1-3")}
                className={`${
                  participacao === "1-3"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                1-3
              </Button>
              <Button
                variant="ghost"
                onClick={() => setParticipacao("4-10")}
                className={`${
                  participacao === "4-10"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                4-10
              </Button>
              <Button
                variant="ghost"
                onClick={() => setParticipacao("10+")}
                className={`${
                  participacao === "10+"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                10+
              </Button>
              <Button
                variant="ghost"
                onClick={() => setParticipacao("outro")}
                className={`${
                  participacao === "outro"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Outro
              </Button>
            </div>
            {participacao === "outro" && (
              <Input
                type="number"
                min={0}
                placeholder="Mín. de inscrições (ex: 15)"
                value={customParticipacao}
                onChange={(e) => setCustomParticipacao(e.target.value)}
                className="mt-2 bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            )}
          </div>

          {/* Tipo de parceiro */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-3">Tipo de parceiro</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="e-parceiro"
                  checked={eParceiro}
                  onCheckedChange={(checked) => setEParceiro(checked as boolean)}
                  className="border-muted-foreground"
                />
                <label
                  htmlFor="e-parceiro"
                  className="text-sm text-foreground cursor-pointer"
                >
                  É parceiro
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="nao-e-parceiro"
                  checked={naoEParceiro}
                  onCheckedChange={(checked) => setNaoEParceiro(checked as boolean)}
                  className="border-muted-foreground"
                />
                <label
                  htmlFor="nao-e-parceiro"
                  className="text-sm text-foreground cursor-pointer"
                >
                  Não é parceiro
                </label>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3 pt-4">
            <Button
              onClick={handleApplyFilters}
              className="w-full bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90 font-medium"
            >
              Aplicar filtros
            </Button>
            <button
              onClick={handleClearFilters}
              className="w-full text-foreground hover:text-foreground/80 text-sm transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
