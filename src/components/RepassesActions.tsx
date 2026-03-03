import { Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RepassesActionsProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onExportClick: () => void;
}

export const RepassesActions = ({
  searchValue,
  onSearchChange,
  onExportClick,
}: RepassesActionsProps) => {
  return (
    <div className="flex items-center justify-between gap-4 mb-10">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar repasse..."
          className="pl-10 bg-card border-border"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <Button variant="secondary" onClick={onExportClick}>
        <Download className="h-4 w-4 mr-2" />
        Exportar
      </Button>
    </div>
  );
};
