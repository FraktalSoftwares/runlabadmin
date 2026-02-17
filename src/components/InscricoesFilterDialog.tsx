import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import type { InscricoesFilters } from "@/hooks/useCompetitionDetails";

interface InscricoesFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters?: InscricoesFilters;
  onApply: (filters: InscricoesFilters) => void;
}

const PARTICIPACAO_TO_MIN: Record<string, number> = {
  "1-3": 1,
  "4-10": 4,
  "10+": 10,
};

export const InscricoesFilterDialog = ({
  open,
  onOpenChange,
  initialFilters = {},
  onApply,
}: InscricoesFilterDialogProps) => {
  const [status, setStatus] = useState<string>("all");
  const [plano, setPlano] = useState<string>("");
  const [cidade, setCidade] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [distancia, setDistancia] = useState<string>("");
  const [customDistancia, setCustomDistancia] = useState<string>("");
  const [participacao, setParticipacao] = useState<string>("");
  const [isParceiro, setIsParceiro] = useState<boolean>(false);
  const [naoEParceiro, setNaoEParceiro] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    setStatus(initialFilters.status ?? "all");
    setPlano(initialFilters.plano ?? "");
    setCidade(initialFilters.cidade ?? "");
    setEstado(initialFilters.estado ?? "");
    setDistancia(initialFilters.distanceLabel ?? "");
    setCustomDistancia("");
    setParticipacao(
      initialFilters.participacaoMin != null
        ? Object.entries(PARTICIPACAO_TO_MIN).find(([, v]) => v === initialFilters.participacaoMin)?.[0] ?? ""
        : ""
    );
    setIsParceiro(initialFilters.isParceiro ?? false);
    setNaoEParceiro(initialFilters.naoEParceiro ?? false);
  }, [open, initialFilters]);

  const handleClearFilters = () => {
    setStatus("all");
    setPlano("");
    setCidade("");
    setEstado("");
    setDistancia("");
    setCustomDistancia("");
    setParticipacao("");
    setIsParceiro(false);
    setNaoEParceiro(false);
    onApply({});
    onOpenChange(false);
  };

  const buildFilters = (): InscricoesFilters => {
    const f: InscricoesFilters = {};
    if (status && status !== "all") {
      f.status = status as "pending" | "confirmed" | "cancelled";
    }
    if (distancia) {
      if (distancia === "outro" && customDistancia.trim()) {
        const km = parseFloat(customDistancia.replace(",", "."));
        if (!Number.isNaN(km)) f.distanceMeters = Math.round(km * 1000);
      } else if (distancia !== "outro") {
        f.distanceLabel = distancia;
      }
    }
    if (isParceiro) f.isParceiro = true;
    if (naoEParceiro) f.naoEParceiro = true;
    const min = participacao ? PARTICIPACAO_TO_MIN[participacao] : undefined;
    if (min != null) f.participacaoMin = min;
    if (cidade?.trim()) f.cidade = cidade.trim();
    if (estado?.trim()) f.estado = estado.trim();
    if (plano?.trim()) f.plano = plano.trim();
    return f;
  };

  const handleApplyFilters = () => {
    onApply(buildFilters());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-0 sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Filtro</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Status da inscrição */}
          <div>
            <Label className="text-foreground mb-3 block">Status da inscrição</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Todos" },
                { value: "pending", label: "Pendente" },
                { value: "confirmed", label: "Confirmado" },
                { value: "cancelled", label: "Cancelado" },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  onClick={() => setStatus(status === opt.value ? "all" : opt.value)}
                  className={
                    status === opt.value
                      ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                      : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                  }
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Plano de assinatura */}
          <div>
            <Label className="text-foreground mb-3 block">Plano de assinatura</Label>
            <div className="flex gap-2">
              <Button
                onClick={() => setPlano(plano === "gratuito" ? "" : "gratuito")}
                className={`flex-1 ${
                  plano === "gratuito"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Gratuito
              </Button>
              <Button
                onClick={() => setPlano(plano === "essencial" ? "" : "essencial")}
                className={`flex-1 ${
                  plano === "essencial"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Essencial
              </Button>
              <Button
                onClick={() => setPlano(plano === "plus" ? "" : "plus")}
                className={`flex-1 ${
                  plano === "plus"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Plus
              </Button>
            </div>
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-foreground mb-3 block">Cidade</Label>
              <Input
                type="text"
                placeholder="Ex: São Paulo"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <Label className="text-foreground mb-3 block">Estado</Label>
              <Input
                type="text"
                placeholder="Ex: SP"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Última distância corrida */}
          <div>
            <Label className="text-foreground mb-3 block">Última distância corrida</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {["3 km", "5 km", "10 km", "21 km", "42 km"].map((dist) => (
                <Button
                  key={dist}
                  onClick={() => setDistancia(distancia === dist ? "" : dist)}
                  className={`${
                    distancia === dist
                      ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                      : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                  }`}
                >
                  {dist}
                </Button>
              ))}
            </div>
            <Button
              onClick={() => setDistancia(distancia === "outro" ? "" : "outro")}
              className={`mb-2 ${
                distancia === "outro"
                  ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                  : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
              }`}
            >
              Outro
            </Button>
            {distancia === "outro" && (
              <Input
                type="text"
                placeholder="Inserir outra distância percorrida"
                value={customDistancia}
                onChange={(e) => setCustomDistancia(e.target.value)}
                className="bg-[#2A2A2A] border-0 text-foreground placeholder:text-muted-foreground"
              />
            )}
          </div>

          {/* Participação em provas */}
          <div>
            <Label className="text-foreground mb-3 block">Participação em provas</Label>
            <div className="flex gap-2">
              <Button
                onClick={() => setParticipacao(participacao === "nenhuma" ? "" : "nenhuma")}
                className={`flex-1 ${
                  participacao === "nenhuma"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Nenhuma
              </Button>
              <Button
                onClick={() => setParticipacao(participacao === "1-3" ? "" : "1-3")}
                className={`flex-1 ${
                  participacao === "1-3"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                1-3
              </Button>
              <Button
                onClick={() => setParticipacao(participacao === "4-10" ? "" : "4-10")}
                className={`flex-1 ${
                  participacao === "4-10"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                4-10
              </Button>
              <Button
                onClick={() => setParticipacao(participacao === "10+" ? "" : "10+")}
                className={`flex-1 ${
                  participacao === "10+"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                10+
              </Button>
              <Button
                onClick={() => setParticipacao(participacao === "outro" ? "" : "outro")}
                className={`${
                  participacao === "outro"
                    ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                    : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                }`}
              >
                Outro
              </Button>
            </div>
          </div>

          {/* Tipo de parceiro */}
          <div>
            <Label className="text-foreground mb-3 block">Tipo de parceiro</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="parceiro" 
                  checked={isParceiro}
                  onCheckedChange={(checked) => setIsParceiro(checked as boolean)}
                  className="border-muted-foreground data-[state=checked]:bg-[#D4FF00] data-[state=checked]:border-[#D4FF00]"
                />
                <label htmlFor="parceiro" className="text-foreground cursor-pointer">
                  É parceiro
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox 
                  id="nao-parceiro" 
                  checked={naoEParceiro}
                  onCheckedChange={(checked) => setNaoEParceiro(checked as boolean)}
                  className="border-muted-foreground data-[state=checked]:bg-[#D4FF00] data-[state=checked]:border-[#D4FF00]"
                />
                <label htmlFor="nao-parceiro" className="text-foreground cursor-pointer">
                  Não é parceiro
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleApplyFilters}
            className="w-full bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90 font-medium"
          >
            Aplicar filtros
          </Button>
          <button
            onClick={handleClearFilters}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
