import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TIPO_USER_ADMIN } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";

function getRequiredPermission(pathname: string): string | null {
  if (pathname.startsWith("/gestao-competicoes")) return "competicoes.view";
  if (pathname.startsWith("/parceiros")) return "usuarios.view";
  if (pathname.startsWith("/corredores")) return "usuarios.view";
  if (pathname.startsWith("/financeiro")) return "financeiro.view";
  return null;
}

export function AdminGuard() {
  const { user, profile, profileLoading, loading, signOut } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const isAdmin = profile?.tipo_user === TIPO_USER_ADMIN;
  const requiredPerm = getRequiredPermission(location.pathname);
  const hasRouteAccess = !requiredPerm || hasPermission(requiredPerm);

  if (loading || profileLoading || (isAdmin && permissionsLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Sem permissão
          </h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar o painel administrativo. Entre em contato com um administrador se acredita que isso é um erro.
          </p>
          <Button
            variant="outline"
            className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={async () => {
              await signOut();
              window.location.href = "/";
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  if (!hasRouteAccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Sem permissão
          </h1>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta página. Entre em contato com um administrador para solicitar acesso.
          </p>
          <Button
            variant="outline"
            className="gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={() => window.history.back()}
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
