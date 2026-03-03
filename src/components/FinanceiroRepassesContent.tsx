import { useState, useEffect, useCallback } from "react";
import { RepassesActions } from "@/components/RepassesActions";
import { RepassesTable } from "@/components/RepassesTable";
import { Pagination } from "@/components/Pagination";
import { RepasseDetailsDialog } from "@/components/RepasseDetailsDialog";
import { ExportDialog } from "@/components/ExportDialog";
import { PendingWithdrawalsBanner } from "@/components/PendingWithdrawalsBanner";
import { SolicitacoesSaqueDialog } from "@/components/SolicitacoesSaqueDialog";
import { downloadRepassesCsv } from "@/lib/exportFinanceiroCsv";
import { toast } from "@/hooks/use-toast";
import { useRepasses, type RepasseRow } from "@/hooks/useRepasses";

const PAGE_SIZE = 10;

export const FinanceiroRepassesContent = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedRepasse, setSelectedRepasse] = useState<RepasseRow | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [solicitacoesOpen, setSolicitacoesOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: rows = [], isLoading, isError, error } = useRepasses(
    debouncedSearch || undefined,
  );

  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      downloadRepassesCsv(rows);
      toast({ title: "Exportação concluída", description: "O CSV foi baixado." });
      setExportDialogOpen(false);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [rows]);

  const handleRowClick = useCallback((repasse: RepasseRow) => {
    setSelectedRepasse(repasse);
    setDetailsDialogOpen(true);
  }, []);

  return (
    <>
      <RepassesActions
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onExportClick={() => setExportDialogOpen(true)}
      />

      <PendingWithdrawalsBanner onClick={() => setSolicitacoesOpen(true)} />

      <RepassesTable
        rows={paginatedRows}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRowClick={handleRowClick}
      />

      {!isLoading && !isError && rows.length > 0 && (
        <Pagination
          total={rows.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      <RepasseDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        repasse={selectedRepasse}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        exporting={exporting}
      />

      <SolicitacoesSaqueDialog
        open={solicitacoesOpen}
        onOpenChange={setSolicitacoesOpen}
      />
    </>
  );
};
