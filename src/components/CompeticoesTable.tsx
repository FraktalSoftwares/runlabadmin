import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { MoreVertical, Pencil, Trash2, Power, XCircle, X, Loader2 } from "lucide-react";
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
import { usePermissions } from "@/hooks/usePermissions";
import { Pagination } from "@/components/Pagination";
import { toast } from "sonner";
import { useCompetitions } from "@/hooks/useCompetitions";
import type { CompetitionRow } from "@/hooks/useCompetitions";
import { useCompeticoesFilters } from "@/contexts/CompeticoesFilterContext";
import { supabase } from "@/lib/supabase";

const getStatusBadge = (status: string) => {
  switch (status) {
    case "finalizada":
    case "fechada":
      return (
        <Badge variant="outline" className="bg-muted/10 text-muted-foreground border-muted">
          Finalizada
        </Badge>
      );
    case "em_andamento":
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          Em andamento
        </Badge>
      );
    case "aberta":
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          Aberta
        </Badge>
      );
    case "rascunho":
      return (
        <Badge variant="outline" className="bg-muted/10 text-muted-foreground border-muted">
          Rascunho
        </Badge>
      );
    default:
      return null;
  }
};

/** Maps UI status back to DB status for updates */
const statusToDb = (uiStatus: string): string => {
  switch (uiStatus) {
    case "aberta": return "open";
    case "em_andamento": return "in_progress";
    case "finalizada":
    case "fechada": return "finished";
    case "rascunho": return "draft";
    default: return "draft";
  }
};

/** Returns the target DB status for toggling activate/deactivate */
const getToggleTarget = (uiStatus: string): { dbStatus: string; label: string } => {
  switch (uiStatus) {
    case "aberta":
    case "em_andamento":
      return { dbStatus: "closed", label: "Desativar" };
    case "rascunho":
    case "fechada":
    case "finalizada":
    default:
      return { dbStatus: "open", label: "Ativar" };
  }
};

const PAGE_SIZE = 10;

export const CompeticoesTable = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { filters } = useCompeticoesFilters();
  const { data: rows, loading, error, refetch } = useCompetitions(filters);
  const [page, setPage] = useState(1);

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CompetitionRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const paginatedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── Excluir ──────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from("competitions")
        .delete()
        .eq("id", selectedItem.id);

      if (deleteError) throw deleteError;

      toast.success("Competição excluída", { description: `"${selectedItem.nome}" foi excluída com sucesso.` });
      refetch();
    } catch (e) {
      toast.error("Erro ao excluir", { description: e instanceof Error ? e.message : "Não foi possível excluir a competição." });
    } finally {
      setActionLoading(false);
      setDeleteDialogOpen(false);
      setSelectedItem(null);
    }
  };

  // ─── Ativar / Desativar ───────────────────────────────

  const handleToggleStatus = async () => {
    if (!selectedItem) return;
    const { dbStatus } = getToggleTarget(selectedItem.status);
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("competitions")
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;

      const actionLabel = dbStatus === "open" ? "ativada" : "desativada";
      toast.success(`Competição ${actionLabel}`, { description: `"${selectedItem.nome}" foi ${actionLabel} com sucesso.` });
      refetch();
    } catch (e) {
      toast.error("Erro ao alterar status", { description: e instanceof Error ? e.message : "Não foi possível alterar o status." });
    } finally {
      setActionLoading(false);
      setToggleDialogOpen(false);
      setSelectedItem(null);
    }
  };

  // ─── Encerrar manualmente ─────────────────────────────

  const handleClose = async () => {
    if (!selectedItem) return;
    setActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from("competitions")
        .update({ status: "finished", updated_at: new Date().toISOString() })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;

      toast.success("Competição encerrada", { description: `"${selectedItem.nome}" foi encerrada manualmente.` });
      refetch();
    } catch (e) {
      toast.error("Erro ao encerrar", { description: e instanceof Error ? e.message : "Não foi possível encerrar a competição." });
    } finally {
      setActionLoading(false);
      setCloseDialogOpen(false);
      setSelectedItem(null);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="px-6 py-4 bg-[#262626]">
        <h2 className="text-xl font-semibold text-foreground">Competições</h2>
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
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Modalidade</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Prazo Inscrições</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Prazo prova</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Inscritos</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Tipo</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Formato</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Campeonato</TableHead>
              <TableHead className="font-medium" style={{ color: '#E0E0E0' }}>Status</TableHead>
              <TableHead className="font-medium w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  Nenhuma competição encontrada.
                </TableCell>
              </TableRow>
            ) : (
              paginatedRows.map((row) => {
                const toggle = getToggleTarget(row.status);
                const isFinished = row.status === "finalizada" || row.status === "fechada";

                return (
                  <TableRow
                    key={row.id}
                    onClick={() => navigate(`/gestao-competicoes/${row.id}`)}
                    className="border-border hover:bg-muted/50 cursor-pointer transition-colors bg-[#262626]"
                  >
                    <TableCell className="text-foreground">{row.nome}</TableCell>
                    <TableCell className="text-foreground">{row.modalidade}</TableCell>
                    <TableCell className="text-foreground">{row.prazoInscricoes}</TableCell>
                    <TableCell className="text-foreground">{row.prazoProva}</TableCell>
                    <TableCell className="text-foreground">{row.inscritos}</TableCell>
                    <TableCell className="text-foreground">{row.tipo}</TableCell>
                    <TableCell className="text-foreground">{row.formato}</TableCell>
                    <TableCell className="text-foreground">{row.campeonato}</TableCell>
                    <TableCell>{getStatusBadge(row.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 border-0 p-6 bg-[#262626] space-y-2"
                          style={{ boxShadow: '0 4px 12px 0 #00000026' }}
                        >
                          {/* Editar */}
                          {hasPermission("competicoes.edit") && (
                            <DropdownMenuItem
                              className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/gestao-competicoes/${row.id}/editar`);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-3" />
                              Editar
                            </DropdownMenuItem>
                          )}

                          {/* Excluir */}
                          {hasPermission("competicoes.edit") && (
                            <DropdownMenuItem
                              className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(row);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-3" />
                              Excluir
                            </DropdownMenuItem>
                          )}

                          {/* Ativar / Desativar */}
                          {hasPermission("competicoes.edit") && (
                            <DropdownMenuItem
                              className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(row);
                                setToggleDialogOpen(true);
                              }}
                            >
                              <Power className="h-4 w-4 mr-3" />
                              {toggle.label}
                            </DropdownMenuItem>
                          )}

                          {/* Encerrar manualmente */}
                          {hasPermission("competicoes.edit") && !isFinished && (
                            <DropdownMenuItem
                              className="cursor-pointer py-3 px-3 rounded-md hover:bg-[#1A1A1A] border border-transparent hover:border-border/50 transition-all text-yellow-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(row);
                                setCloseDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-3" />
                              Encerrar manualmente
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
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

      {/* ─── Dialog: Excluir ─────────────────────────────── */}
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
              Deseja excluir esta competição?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza de que deseja excluir{" "}
              <strong className="text-foreground">"{selectedItem?.nome}"</strong>?
              Todos os dados relacionados (inscrições, corridas, lotes, documentos) serão
              permanentemente removidos. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel
              className="bg-transparent border border-border text-foreground hover:bg-muted"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir competição"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dialog: Ativar / Desativar ──────────────────── */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent className="bg-[#3A3A3A] border-0 text-foreground max-w-md">
          <button
            onClick={() => setToggleDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-foreground">
              {selectedItem ? getToggleTarget(selectedItem.status).label : "Alterar"} competição?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {selectedItem && getToggleTarget(selectedItem.status).dbStatus === "open"
                ? (
                  <>
                    A competição <strong className="text-foreground">"{selectedItem?.nome}"</strong> será
                    ativada e ficará visível para os atletas realizarem inscrições.
                  </>
                )
                : (
                  <>
                    A competição <strong className="text-foreground">"{selectedItem?.nome}"</strong> será
                    desativada e não aceitará novas inscrições.
                  </>
                )
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel
              className="bg-transparent border border-border text-foreground hover:bg-muted"
              onClick={() => setToggleDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="border-0 hover:brightness-90 transition-all"
              style={{ backgroundColor: '#CCF725', color: '#1A1A1A' }}
              onClick={handleToggleStatus}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                selectedItem ? getToggleTarget(selectedItem.status).label : "Confirmar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dialog: Encerrar manualmente ────────────────── */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="bg-[#3A3A3A] border-0 text-foreground max-w-md">
          <button
            onClick={() => setCloseDialogOpen(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-foreground">
              Encerrar competição manualmente?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              A competição <strong className="text-foreground">"{selectedItem?.nome}"</strong> será
              marcada como finalizada. Novas inscrições e corridas não serão mais aceitas.
              Essa ação pode ser revertida ativando a competição novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel
              className="bg-transparent border border-border text-foreground hover:bg-muted"
              onClick={() => setCloseDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-yellow-600 text-white hover:bg-yellow-600/90"
              onClick={handleClose}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Encerrando...
                </>
              ) : (
                "Encerrar competição"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
