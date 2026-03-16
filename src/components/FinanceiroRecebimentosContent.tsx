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
import { downloadRecebimentosCsv } from "@/lib/exportFinanceiroCsv";
import { toast } from "sonner";
import {
  useRecebimentos,
  type RecebimentoRow,
  type RecebimentoStatus,
} from "@/hooks/useRecebimentos";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: RecebimentoStatus; label: string }[] = [
  { value: "pago", label: "Pago" },
  { value: "em_aberto", label: "Em aberto" },
  { value: "vencido", label: "Vencido" },
  { value: "reembolsado", label: "Reembolsado" },
  { value: "cancelado", label: "Cancelado" },
];

const TIPO_OPTIONS = [
  { value: "Inscrição", label: "Inscrição" },
  { value: "Assinatura", label: "Assinatura" },
  { value: "Créditos", label: "Créditos" },
];

function StatusBadge({ status }: { status: RecebimentoStatus }) {
  switch (status) {
    case "pago":
      return (
        <Badge className="bg-[#B0E8D1] text-[#174F38] hover:bg-[#B0E8D1]/90 border-0 min-w-[90px] justify-center">
          Pago
        </Badge>
      );
    case "em_aberto":
      return (
        <Badge className="bg-[#C5CCD3] text-[#2C333A] hover:bg-[#C5CCD3]/90 border-0 min-w-[90px] justify-center">
          Em aberto
        </Badge>
      );
    case "vencido":
      return (
        <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/20 border-0 min-w-[90px] justify-center">
          Vencido
        </Badge>
      );
    case "reembolsado":
      return (
        <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20 border-0 min-w-[90px] justify-center">
          Reembolsado
        </Badge>
      );
    case "cancelado":
      return (
        <Badge className="bg-muted text-muted-foreground hover:bg-muted border-0 min-w-[90px] justify-center">
          Cancelado
        </Badge>
      );
    default:
      return null;
  }
}

export const FinanceiroRecebimentosContent = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecebimentoStatus | "">("");
  const [tipoFilter, setTipoFilter] = useState("");
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

  const { data: rows, isLoading, isError, error } = useRecebimentos(
    debouncedSearch || undefined,
  );

  const filteredRows = useMemo(() => {
    let result = rows ?? [];
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }
    if (tipoFilter) {
      result = result.filter((r) => r.tipoRecebimento === tipoFilter);
    }
    return result;
  }, [rows, statusFilter, tipoFilter]);

  const paginatedRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, tipoFilter]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      downloadRecebimentosCsv(filteredRows);
      toast.success("Exportação concluída", { description: "O CSV foi baixado." });
      setExportDialogOpen(false);
    } catch {
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }, [filteredRows]);

  const activeFilterCount = (statusFilter ? 1 : 0) + (tipoFilter ? 1 : 0);

  return (
    <>
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-4 mb-10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar recebimento..."
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
            Recebimentos de usuários
          </h2>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16 bg-[#262626]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {isError && (
          <div className="px-6 py-4 text-destructive text-sm bg-[#262626]">
            {error instanceof Error ? error.message : "Erro ao carregar recebimentos."}
          </div>
        )}

        {!isLoading && !isError && (
          <Table>
            <TableHeader>
              <TableRow className="bg-[#4D4D4D] hover:bg-[#4D4D4D] border-b border-[#808080]">
                <TableHead className="text-xs font-medium text-[#E0E0E0]">ID</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Nome</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Recebimento</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Competição</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Valor</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Data</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Pagamento</TableHead>
                <TableHead className="text-xs font-medium text-[#E0E0E0]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    Nenhum recebimento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => (
                  <RecebimentoRowItem key={row.id} row={row} />
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
            <DialogTitle className="text-foreground">Filtrar recebimentos</DialogTitle>
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

            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Tipo de recebimento</h3>
              <div className="flex flex-wrap gap-2">
                {TIPO_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    variant="ghost"
                    onClick={() =>
                      setTipoFilter((prev) => (prev === opt.value ? "" : opt.value))
                    }
                    className={
                      tipoFilter === opt.value
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
                setTipoFilter("");
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

function RecebimentoRowItem({ row }: { row: RecebimentoRow }) {
  return (
    <TableRow className="border-b border-[#808080] hover:bg-muted/30 transition-colors bg-[#262626]">
      <TableCell className="text-sm text-[#E0E0E0]">{row.shortId}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.nome}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.tipoRecebimento}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.competicao}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{formatCurrency(row.valor)}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.data}</TableCell>
      <TableCell className="text-sm text-[#E0E0E0]">{row.pagamento}</TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
      </TableCell>
    </TableRow>
  );
}
