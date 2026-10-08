import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_KEYS } from "@/lib/permissions";

const DELETE_ACCOUNT_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Você não tem permissão para excluir contas.",
  TARGET_NOT_FOUND: "Esta conta não existe mais.",
  SELF_DELETION_FORBIDDEN: "Não é permitido excluir a própria conta.",
  TARGET_IS_ADMIN:
    "Administradores não podem ser excluídos por aqui. Remova o acesso de administrador primeiro.",
};

const getDeleteAccountErrorMessage = async (error: unknown): Promise<string> => {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = (await context.clone().json()) as { error?: string };
      if (body.error && DELETE_ACCOUNT_ERROR_MESSAGES[body.error]) {
        return DELETE_ACCOUNT_ERROR_MESSAGES[body.error];
      }
    } catch {
      // A resposta pode não ser JSON em falhas de rede ou gateway.
    }
  }

  return "Não foi possível excluir a conta. Tente novamente.";
};

interface ExcluirContaButtonProps {
  userId: string;
  userName: string;
  redirectTo: string;
}

export const ExcluirContaButton = ({ userId, userName, redirectTo }: ExcluirContaButtonProps) => {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!hasPermission(PERMISSION_KEYS.USUARIOS_DELETE)) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("admin-delete-account", {
        body: { target_user_id: userId },
      });
      if (error) throw new Error(await getDeleteAccountErrorMessage(error));

      toast.success("Conta excluída", { description: `A conta de ${userName} foi excluída.` });
      setOpen(false);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      toast.error("Erro ao excluir conta", {
        description: e instanceof Error ? e.message : "Não foi possível excluir a conta.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 border-0 hover:brightness-90 transition-all"
        style={{ backgroundColor: "#1A1A1A", color: "#EF4444" }}
      >
        <Trash2 className="w-4 h-4" />
        Excluir conta
      </Button>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent className="bg-[#2a2a2a] border-0 sm:max-w-[500px] p-8">
          <button
            onClick={() => setOpen(false)}
            disabled={deleting}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Close</span>
          </button>

          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold text-foreground">Excluir conta?</h2>
              <p className="text-base text-foreground">
                Tem certeza de que deseja excluir a conta de <strong>{userName}</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                O login, o perfil, os documentos e os dados vinculados a esta conta serão
                apagados permanentemente. Essa ação não pode ser desfeita.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="flex-1 bg-transparent border-2 border-muted-foreground/30 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={deleting}
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Excluindo..." : "Excluir conta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
