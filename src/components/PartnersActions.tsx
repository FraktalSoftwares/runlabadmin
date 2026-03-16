import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal, Download, Send, Plus } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { ExportDialog } from "./ExportDialog";
import { PartnersFilterDialog, type PartnersFilterValues } from "./PartnersFilterDialog";
import { PushNotificationSheet } from "./PushNotificationSheet";
import { RegisterPartnerSheet } from "./RegisterPartnerSheet";
import { downloadParceirosCsv } from "@/lib/exportFinanceiroCsv";
import { toast } from "sonner";
import type { PartnerRow } from "@/hooks/usePartners";

type PartnersActionsProps = {
  search?: string;
  onSearchChange?: (value: string) => void;
  partners: PartnerRow[];
  filters: PartnersFilterValues;
  onFiltersChange: (filters: PartnersFilterValues) => void;
};

export const PartnersActions = ({ search = "", onSearchChange, partners, filters, onFiltersChange }: PartnersActionsProps) => {
  const { hasPermission } = usePermissions();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isPushOpen, setIsPushOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      downloadParceirosCsv(partners);
      toast.success("Exportação concluída", { description: "O CSV de parceiros foi baixado." });
      setIsExportOpen(false);
    } catch {
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  }, [partners]);

  const activeFilterCount = (filters.status ? 1 : 0) + (filters.type ? 1 : 0);

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar parceiro..."
            className="pl-10 bg-input border-border text-foreground"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={() => setIsFilterOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={() => setIsExportOpen(true)}
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          
          <div className="w-px h-6 bg-border" />
          
          <Button 
            variant="outline" 
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2"
            onClick={() => setIsPushOpen(true)}
          >
            <Send className="h-4 w-4" />
            Enviar push
          </Button>
          
          {hasPermission("usuarios.add") && (
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              onClick={() => setIsRegisterOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Cadastrar parceiro
            </Button>
          )}
        </div>
      </div>

      <ExportDialog open={isExportOpen} onOpenChange={setIsExportOpen} onExport={handleExport} exporting={exporting} />
      <PartnersFilterDialog open={isFilterOpen} onOpenChange={setIsFilterOpen} filters={filters} onApply={onFiltersChange} />
      <PushNotificationSheet open={isPushOpen} onOpenChange={setIsPushOpen} targetAudience="Parceiro" />
      <RegisterPartnerSheet open={isRegisterOpen} onOpenChange={setIsRegisterOpen} />
    </>
  );
};
