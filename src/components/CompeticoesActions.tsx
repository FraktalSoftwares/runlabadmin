import { Search, SlidersHorizontal, Download, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterDialog } from "@/components/FilterDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useCompeticoesFilters } from "@/contexts/CompeticoesFilterContext";
import { downloadCompetitionsCsv } from "@/lib/exportCompetitionsCsv";
import { toast } from "sonner";

export const CompeticoesActions = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { filters, setFilters } = useCompeticoesFilters();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");

  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  const debouncedSetSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: searchInput.trim() || undefined }));
  }, [searchInput, setFilters]);

  useEffect(() => {
    const t = setTimeout(debouncedSetSearch, 400);
    return () => clearTimeout(t);
  }, [searchInput, debouncedSetSearch]);

  const handleExport = async () => {
    try {
      await downloadCompetitionsCsv(filters);
      toast.success("Exportação concluída", { description: "O CSV foi baixado com a lista de competições." });
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  return (
    <>
    <div className="flex items-center justify-between gap-4 mb-10">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar competição..." 
          className="pl-10 bg-card border-border"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-3">
        <Button 
          variant="secondary" 
          onClick={() => setFilterDialogOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filtrar
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleExport}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
        {hasPermission("competicoes.add") && (
          <>
            <span className="text-muted-foreground">|</span>
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/gestao-competicoes/cadastrar-competicao")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Cadastrar competição
            </Button>
          </>
        )}
      </div>
    </div>

    <FilterDialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen} />
    </>
  );
};
