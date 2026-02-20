import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import logo from "@/assets/runlab-logo.png";
import heroImage from "@/assets/login-hero.png";

type Screen = "request" | "check_email" | "set_password" | "success";

const getRecoveryRedirectUrl = () => {
  const origin = window.location.origin;
  return `${origin}/recuperacao-senha`;
};

const PasswordRecovery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const emailFromLogin = (location.state?.email as string) || "";

  const [email, setEmail] = useState(emailFromLogin);
  const [screen, setScreen] = useState<Screen>("request");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [isCheckingRecovery, setIsCheckingRecovery] = useState(true);

  // Detectar sessão de recuperação ao abrir o link do e-mail (hash na URL)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setScreen("set_password");
        // Limpar hash da URL por segurança e UX
        window.history.replaceState(null, "", window.location.pathname);
      }
    });

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const type = params.get("type");
    if (type === "recovery" || type === "invite" || hash.includes("access_token")) {
      // Supabase processa o hash; onAuthStateChange dispara PASSWORD_RECOVERY (recovery) ou SIGNED_IN (invite)
      // Se já tiver sessão e for recovery/invite, mostrar form de definir senha (fallback)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const isRecoveryOrInvite =
            type === "recovery" ||
            type === "invite" ||
            hash.includes("type=recovery") ||
            hash.includes("type=invite");
          if (isRecoveryOrInvite) setScreen("set_password");
          window.history.replaceState(null, "", window.location.pathname);
        }
        setIsCheckingRecovery(false);
      });
    } else {
      setIsCheckingRecovery(false);
    }

    return () => subscription.unsubscribe();
  }, []);

  // Timer para reenviar e-mail
  useEffect(() => {
    if (screen !== "check_email" || resendTimer <= 0) return;
    const t = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    return () => clearInterval(t);
  }, [screen, resendTimer]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Digite seu e-mail.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: getRecoveryRedirectUrl(),
    });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message === "Email not confirmed" ? "E-mail ainda não confirmado." : error.message);
      return;
    }
    setEmail(trimmed);
    setScreen("check_email");
    setResendTimer(60);
    toast.success("E-mail enviado. Verifique sua caixa de entrada.");
  };

  const handleResendEmail = async () => {
    if (resendTimer > 0) return;
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getRecoveryRedirectUrl(),
    });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResendTimer(60);
    toast.success("E-mail reenviado.");
  };

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
    toast.success("Senha atualizada. Faça login com a nova senha.");
  };

  const handleGoToLogin = () => {
    navigate("/login", { replace: true });
  };

  const showHero = screen !== "check_email" && screen !== "success";
  const fullWidth = screen === "check_email" || screen === "success";
  const darkBg = screen === "success";

  if (isCheckingRecovery && window.location.hash) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {showHero && (
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden h-screen">
          <img
            src={heroImage}
            alt="RUNLAB Athletes"
            className="object-cover w-full h-full"
          />
        </div>
      )}

      <div
        className={`${fullWidth ? "w-full" : "w-full lg:w-1/2"} flex ${fullWidth ? "items-center" : "items-start"} justify-center p-4 md:p-6 ${darkBg ? "bg-black" : "bg-background"} h-screen overflow-y-auto`}
      >
        <div className="w-full max-w-md space-y-4">
          {showHero && (
            <div className="flex justify-center mt-12 mb-24">
              <img src={logo} alt="RUNLAB" className="h-12" />
            </div>
          )}

          {screen === "success" ? (
            <div className="flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-8 h-8 text-black" />
              </div>
              <h1 className="text-xl font-normal text-white">
                Sua senha foi atualizada com sucesso
              </h1>
              <Button
                onClick={handleGoToLogin}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                size="lg"
              >
                Ir para o login
              </Button>
            </div>
          ) : screen === "set_password" ? (
            <>
              <div className="text-left space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Defina sua nova senha
                </h1>
                <p className="text-sm text-muted-foreground">
                  Tudo certo! Agora é só definir uma nova senha para acessar sua conta.
                </p>
              </div>

              <form onSubmit={handleSetPassword} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="new-password" className="text-sm text-foreground">
                    Nova senha
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                  <label htmlFor="confirm-password" className="text-sm text-foreground">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirme sua nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
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
                      Redefinindo...
                    </>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
              </form>
            </>
          ) : screen === "check_email" ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="mb-8">
                <img src={logo} alt="RUNLAB" className="h-12" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Verifique seu e-mail
              </h1>
              <p className="text-sm text-muted-foreground max-w-sm">
                Enviamos um link de recuperação para{" "}
                <span className="font-medium text-foreground">{email}</span>.
                Clique no link para redefinir sua senha.
              </p>
              <p className="text-xs text-muted-foreground">
                Não recebeu? Verifique a pasta de spam ou reenvie abaixo.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                disabled={resendTimer > 0 || isSubmitting}
                onClick={handleResendEmail}
              >
                {resendTimer > 0
                  ? `Reenviar email (${resendTimer}s)`
                  : "Reenviar email"}
              </Button>
              <button
                type="button"
                onClick={() => setScreen("request")}
                className="text-sm text-primary hover:underline"
              >
                Voltar
              </button>
            </div>
          ) : (
            <>
              <div className="text-left space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                  Recuperação de senha
                </h1>
                <p className="text-sm text-muted-foreground">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleRequestReset} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm text-foreground">
                    E-mail
                  </label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="Digite seu endereço de e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleGoToLogin}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Voltar para o login
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordRecovery;
