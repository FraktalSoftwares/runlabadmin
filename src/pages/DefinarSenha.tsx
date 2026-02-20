import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import logo from "@/assets/runlab-logo.png";
import heroImage from "@/assets/login-hero.png";

/**
 * URL para onde o convidado deve ser redirecionado ao clicar no link do e-mail.
 * Configurar esta mesma URL na Edge Function invite-admin (redirect_to) e em
 * Supabase Auth → URL Configuration → Redirect URLs.
 */
export const getDefinirSenhaRedirectUrl = () => {
  return `${window.location.origin}/definir-senha`;
};

type Screen = "checking" | "set_password" | "success" | "invalid";

const DefinarSenha = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const type = params.get("type");
    const hasInviteOrRecovery =
      type === "invite" ||
      type === "recovery" ||
      hash.includes("access_token");

    if (!hasInviteOrRecovery && !hash) {
      // Sem token na URL: pode ser acesso direto; verifica se já tem sessão
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setScreen("set_password");
        } else {
          setScreen("invalid");
        }
      });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setScreen("set_password");
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setScreen("set_password");
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        setScreen("invalid");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.auth.signOut();
    setScreen("success");
    toast.success("Senha definida. Faça login para acessar o sistema.");
  };

  const handleGoToLogin = () => {
    navigate("/login", { replace: true });
  };

  if (screen === "checking") {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (screen === "invalid") {
    return (
      <div className="h-screen flex overflow-hidden">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden h-screen">
          <img
            src={heroImage}
            alt="RUNLAB Athletes"
            className="object-cover w-full h-full"
          />
        </div>
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background">
          <div className="w-full max-w-md space-y-6 text-center">
            <img src={logo} alt="RUNLAB" className="h-12 mx-auto" />
            <h1 className="text-xl font-semibold text-foreground">
              Link inválido ou expirado
            </h1>
            <p className="text-sm text-muted-foreground">
              Use o link que enviamos no e-mail de convite para definir sua
              senha. Se o problema continuar, peça um novo convite ao
              administrador.
            </p>
            <Button
              onClick={handleGoToLogin}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              size="lg"
            >
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "success") {
    return (
      <div className="h-screen flex overflow-hidden bg-black">
        <div className="w-full flex items-center justify-center p-6">
          <div className="w-full max-w-md flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-xl font-normal text-white">
              Senha definida com sucesso
            </h1>
            <p className="text-sm text-muted-foreground">
              Faça login com seu e-mail e a senha que você acabou de definir.
            </p>
            <Button
              onClick={handleGoToLogin}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              size="lg"
            >
              Ir para o login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden h-screen">
        <img
          src={heroImage}
          alt="RUNLAB Athletes"
          className="object-cover w-full h-full"
        />
      </div>
      <div className="w-full lg:w-1/2 flex items-start justify-center p-6 md:p-8 bg-background h-screen overflow-y-auto">
        <div className="w-full max-w-md space-y-6 mt-12">
          <div className="flex justify-center">
            <img src={logo} alt="RUNLAB" className="h-12" />
          </div>
          <div className="text-left space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Defina sua senha
            </h1>
            <p className="text-sm text-muted-foreground">
              Você foi convidado a acessar o sistema. Escolha uma senha segura
              para concluir seu cadastro.
            </p>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="new-password"
                className="text-sm font-medium text-foreground"
              >
                Senha
              </label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pr-10"
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirm-password"
                className="text-sm font-medium text-foreground"
              >
                Confirmar senha
              </label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              size="lg"
              disabled={
                isSubmitting ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword ||
                newPassword.length < 6
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Concluir cadastro"
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={handleGoToLogin}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefinarSenha;
