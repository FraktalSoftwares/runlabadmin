import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/runlab-logo.png";
import heroImage from "@/assets/login-hero.png";

const TIPO_USER_CORREDOR = "Corredor";

const Login = () => {
  const navigate = useNavigate();
  const { user, profile, profileLoading, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redireciona baseado no tipo de usuário
  useEffect(() => {
    if (!loading && !profileLoading && user && profile) {
      if (profile.tipo_user === TIPO_USER_CORREDOR) {
        navigate("/corredor/planos", { replace: true });
      } else {
        navigate("/financeiro", { replace: true });
      }
    }
  }, [user, profile, profileLoading, loading, navigate]);

  useEffect(() => {
    if (!showLoginSuccess || profileLoading || !profile) return;
    const destination =
      profile.tipo_user === TIPO_USER_CORREDOR
        ? "/corredor/planos"
        : "/financeiro";
    const t = setTimeout(() => navigate(destination), 1200);
    return () => clearTimeout(t);
  }, [showLoginSuccess, profile, profileLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }
    if (data.session) {
      setShowLoginSuccess(true);
    }
  };

  const handleGoogleLogin = () => {
    // Handle Google login logic here
    console.log("Google login");
  };

  const handleForgotPasswordClick = () => {
    navigate('/recuperacao-senha', { state: { email } });
  };

  // Enquanto verifica autenticação, não exibe o formulário
  if (loading || user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left side - Hero Image */}
      {!showLoginSuccess && (
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden h-screen">
          <img
            src={heroImage}
            alt="RUNLAB Athletes"
            className="object-cover w-full h-full"
          />
        </div>
      )}

      {/* Right side - Login Form */}
      <div className={`${showLoginSuccess ? 'w-full' : 'w-full lg:w-1/2'} flex ${showLoginSuccess ? 'items-center' : 'items-start'} justify-center p-4 md:p-6 ${showLoginSuccess ? 'bg-black' : 'bg-background'} h-screen overflow-y-auto`}>
        <div className="w-full max-w-md space-y-4">
          {/* Logo */}
          {!showLoginSuccess && (
            <div className="flex justify-center mt-12 mb-24">
              <img src={logo} alt="RUNLAB" className="h-12" />
            </div>
          )}

          {showLoginSuccess ? (
            <>
              {/* Login Success Screen */}
              <div className="flex flex-col items-center justify-center text-center space-y-6">
                {/* Success Icon */}
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-8 h-8 text-black" />
                </div>

                {/* Success Message */}
                <h1 className="text-xl font-normal text-white">
                  Login realizado com sucesso!
                </h1>

                <div className="w-full max-w-sm">
                  <div className="h-12 rounded-[20px] border-2 border-primary bg-transparent flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Welcome Message */}
              <div className="text-left">
                <h1 className="text-2xl font-bold text-foreground">
                  Bem-vindo de volta!
                </h1>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm text-foreground">
                    E-mail ou telefone
                  </label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="Digite seu endereço de e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-foreground">
                    Senha
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Insira sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="text-left">
                  <button
                    type="button"
                    onClick={handleForgotPasswordClick}
                    className="text-sm text-destructive hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>

                {/* Continue Button */}
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      OU
                    </span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleLogin}
                  className="w-full"
                  size="lg"
                >
                  <svg
                    className="mr-2 h-5 w-5"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Entrar com o Google
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
