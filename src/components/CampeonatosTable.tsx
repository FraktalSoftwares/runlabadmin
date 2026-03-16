import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreVertical, Pencil, Trash2, RefreshCw, XCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { useCampeonatos } from "@/hooks/useCampeonatos";
import type { CampeonatoRow } from "@/hooks/useCampeonatos";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 10;

export const CampeonatosTable = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { data: rows, loading, error, refetch } = useCampeonatos();
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CampeonatoRow | null>(null);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const paginatedData = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      const { error: deleteError } = await supabase.from("championships").delete().eq("id", selectedItem.id);
      if (deleteError) throw deleteError;
      toast.success("Campeonato excluído com sucesso!");
      refetch();
    } catch {
      toast.error("Erro ao excluir campeonato");
    }
    setDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="px-6 py-4 bg-[#262626]">
        <h2 className="text-xl font-semibold text-foreground">Campeonatos</h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="px-6 py-4 text-destructive text-sm">
          {error.message}
        </div>
      )}

      {!loading && !error && (
        <Table>
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header">
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Nome</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Nome reduzido</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Etapas</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Período</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Tipo ranking</TableHead>
              <TableHead className="font-medium w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Nenhum campeonato cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => (
            <TableRow 
              key={item.id} 
              className="border-border hover:bg-muted/50 cursor-pointer transition-colors bg-[#262626]"
            >
              <TableCell className="text-foreground">{item.nome}</TableCell>
              <TableCell className="text-foreground">{item.nomeReduzido}</TableCell>
              <TableCell className="text-foreground">{item.etapas}</TableCell>
              <TableCell className="text-foreground">{item.periodo}</TableCell>
              <TableCell className="text-foreground">{item.tipoRanking}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border-0 p-6 bg-[#262626] space-y-2" style={{ boxShadow: '0 4px 12px 0 #00000026' }}>
                    {hasPermission("competicoes.edit") && (
                      <DropdownMenuItem
                        className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/gestao-competicoes/${item.id}/editar`);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-3" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                      className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      Excluir
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all">
                      <RefreshCw className="h-4 w-4 mr-3" />
                      Ativar/desativar
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all">
                      <XCircle className="h-4 w-4 mr-3" />
                      Encerrar manualmente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {!loading && !error && rows.length > 0 && (
        <Pagination
          total={rows.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#3A3A3A] border-0 text-foreground max-w-md">
          <button 
            onClick={() => setDeleteDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-foreground">
              Deseja excluir este campeonato?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza de que deseja excluir este campeonato? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel 
              className="bg-transparent border border-border text-foreground hover:bg-muted"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir campeonato
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
