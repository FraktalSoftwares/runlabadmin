import { Search, SlidersHorizontal, Download, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExportDialog } from "@/components/ExportDialog";
import { CorredoresFilterDialog } from "@/components/CorredoresFilterDialog";
import { PushNotificationSheet } from "@/components/PushNotificationSheet";
import { useState, useCallback, useEffect } from "react";
import { useCorredoresFilters } from "@/contexts/CorredoresFilterContext";
import { downloadCorredoresCsv } from "@/lib/exportCorredoresCsv";
import { useToast } from "@/hooks/use-toast";

export const CorredoresActions = () => {
  const { filters, setFilters } = useCorredoresFilters();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [pushSheetOpen, setPushSheetOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSearchInput(filters.search ?? "");
  }, [filters.search]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      setFilters((prev) => ({ ...prev, search: value || undefined }));
    },
    [setFilters]
  );

  const handleExport = useCallback(async (_format: string) => {
    setExporting(true);
    try {
      await downloadCorredoresCsv(filters);
      toast({ title: "Exportação concluída", description: "O CSV foi baixado." });
      setExportDialogOpen(false);
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [filters, toast]);

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar corredor..."
            className="pl-10 bg-card border-border"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
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
          <span className="text-muted-foreground">|</span>
          <Button
            variant="secondary"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button
            variant="outline"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2"
            onClick={() => setPushSheetOpen(true)}
          >
            <Send className="h-4 w-4" />
            Enviar push
          </Button>
        </div>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
        exporting={exporting}
      />
      <CorredoresFilterDialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen} />
      <PushNotificationSheet open={pushSheetOpen} onOpenChange={setPushSheetOpen} targetAudience="Corredor" />
    </>
  );
};
