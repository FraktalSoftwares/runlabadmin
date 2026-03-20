import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const TIPO_USER_CORREDOR = "Corredor";

export function CorredorGuard() {
  const { user, profile, profileLoading, loading, signOut } = useAuth();
  const location = useLocation();
  const isCorredor = profile?.tipo_user === TIPO_USER_CORREDOR;

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    // Salva a URL atual para redirecionar de volta após login
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  if (!isCorredor) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-xl font-semibold text-foreground">
            Acesso restrito
          </h1>
          <p className="text-muted-foreground">
            Esta área é exclusiva para corredores.
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

  return <Outlet />;
}
