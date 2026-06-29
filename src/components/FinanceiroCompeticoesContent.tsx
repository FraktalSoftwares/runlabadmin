import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, SlidersHorizontal, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportDialog } from "@/components/ExportDialog";
import { Pagination } from "@/components/Pagination";
import { formatCurrency } from "@/lib/formatCurrency";
import { downloadCompeticoesCsv } from "@/lib/exportFinanceiroCsv";
import { toast } from "sonner";
import {
  useFinanceiroCompeticoes,
  type FinanceiroCompetitionRow,
  type FinanceiroCompetitionStatus,
} from "@/hooks/useFinanceiroCompeticoes";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: FinanceiroCompetitionStatus; label: string }[] = [
  { value: "aberta", label: "Aberta" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "fechada", label: "Fechada" },
  { value: "finalizada", label: "Finalizada" },
  { value: "rascunho", label: "Rascunho" },
];

function StatusBadge({ status }: { status: FinanceiroCompetitionStatus }) {
  switch (status) {
    case "finalizada":
      return (
        <Badge className="bg-[#C5CCD3] text-[#2C333A] hover:bg-[#C5CCD3]/90 border-0 min-w-[100px] justify-center">
          Finalizada
        </Badge>
      );
    case "fechada":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border-0 min-w-[100px] justify-center">
          Fechada
        </Badge>
      );
    case "em_andamento":
      return (
        <Badge className="bg-[#B0E8D1] text-[#174F38] hover:bg-[#B0E8D1]/90 border-0 min-w-[100px] justify-center">
          Em andamento
        </Badge>
      );
    case "aberta":
      return (
        <Badge className="bg-[#B0E8D1] text-[#174F38] hover:bg-[#B0E8D1]/90 border-0 min-w-[100px] justify-center">
          Aberta
        </Badge>
      );
    case "rascunho":
      return (
        <Badge className="bg-muted text-muted-foreground hover:bg-muted/90 border-0 min-w-[100px] justify-center">
          Rascunho
        </Badge>
      );
    default:
      return null;
  }
}

export const FinanceiroCompeticoesContent = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FinanceiroCompetitionStatus | "">("");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debouncedSet = useCallback(() => {
    setDebouncedSearch(searchInput.trim());
  }, [searchInput]);

  useEffect(() => {
    const t = setTimeout(debouncedSet, 400);
    return () => clearTimeout(t);
  }, [searchInput, debouncedSet]);

  const { data: rows, isLoading, isError, error } = useFinanceiroCompeticoes(
    debouncedSearch || undefined,
  );

  const filteredRows = useMemo(() => {
    const all = rows ?? [];
    if (!statusFilter) return all;
    return all.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  const paginatedRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      downloadCompeticoesCsv(filteredRows);
      toast.success("Exportação concluída", { description: "O CSV foi baixado." });
      setExportDialogOpen(false);
    } catch {
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }, [filteredRows]);

  const activeFilterCount = statusFilter ? 1 : 0;

  return (
    <>
      {/* Barra de ações */}
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
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl overflow-hidden">
        <div className="px-7 py-5 bg-[#262626]">
          <h2 className="text-xl font-semibold text-white">
            Transações por competição
          </h2>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 bg-[#262626]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="px-6 py-4 text-destructive text-sm bg-[#262626]">
            {error instanceof Error ? error.message : "Erro ao carregar dados."}
          </div>
        )}

        {!isLoading && !isError && (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#4D4D4D] hover:bg-[#4D4D4D] border-b border-[#808080]">
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[80px]">ID</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[140px]">Nome</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[120px]">Etapa vinculada</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[100px]">Nº inscrições</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[100px]">Margem bruta</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[100px]">Receita total</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[120px]">Comissão parceiros</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0] w-[117px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    Nenhuma competição encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <CompetitionFinanceRow key={row.id} row={row} />
                ))
              )}
            </TableBody>
          </Table>
        )}

        {!isLoading && !isError && filteredRows.length > 0 && (
          <Pagination
            total={filteredRows.length}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Dialog de filtro */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="bg-[#1E1E1E] border-0 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Filtrar competições</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Status</h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="ghost"
                    onClick={() =>
                      setStatusFilter((prev) => (prev === opt.value ? "" : opt.value))
                    }
                    className={
                      statusFilter === opt.value
                        ? "bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90"
                        : "bg-[#2A2A2A] text-foreground hover:bg-[#333333]"
                    }
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => setFilterDialogOpen(false)}
              className="w-full bg-[#D4FF00] text-black hover:bg-[#D4FF00]/90 font-medium"
            >
              Aplicar filtros
            </Button>
            <button
              onClick={() => {
                setStatusFilter("");
                setFilterDialogOpen(false);
              }}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de exportação */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        exporting={exporting}
      />
    </>
  );
};

function CompetitionFinanceRow({ row }: { row: FinanceiroCompetitionRow }) {
  return (
    <TableRow className="border-b border-[#808080] hover:bg-muted/30 transition-colors bg-[#262626]">
      <TableCell className="text-sm text-[#E0E0E0]">{row.numericId}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.nome}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.etapaVinculada}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.inscricoes}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{formatCurrency(row.margemBruta)}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{formatCurrency(row.receitaTotal)}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{formatCurrency(row.comissaoParceiros)}</TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
      </TableCell>
    </TableRow>
  );
}
