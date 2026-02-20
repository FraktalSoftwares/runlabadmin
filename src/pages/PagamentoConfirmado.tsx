import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/runlab-logo.png";

interface LocationState {
  plan: "avulsa" | "anual";
  paymentMethod: string;
  paymentId: string;
  amount: number;
  planName: string;
  planType: string;
  creditsAmount?: number;
}

const PLAN_DEFAULTS = {
  avulsa: {
    name: "CHALLENGE TICKET",
    price: "R$ 59,90",
    type: "Avulso",
  },
  anual: {
    name: "RUNLAB CLUB",
    price: "R$ 610,00",
    type: "Assinatura",
  },
};

const APP_RETURN_URL = import.meta.env.VITE_APP_RETURN_URL || "";

const PagamentoConfirmado = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const state = location.state as LocationState | null;

  const plan = state?.plan || "avulsa";
  const defaults = PLAN_DEFAULTS[plan];

  const planName = state?.planName || defaults.name;
  const planType = state?.planType || defaults.type;
  const amount = state?.amount || (plan === "avulsa" ? 59.9 : 610.0);
  const formattedAmount = `R$ ${amount.toFixed(2).replace(".", ",")}`;
  const creditsAmount = state?.creditsAmount || (plan === "anual" ? 12 : 1);

  const handleReturnToApp = () => {
    if (APP_RETURN_URL) {
      const params = new URLSearchParams({
        status: "success",
        plan,
        planName,
        planType,
        amount: String(amount),
        paymentId: state?.paymentId || "",
        paymentMethod: state?.paymentMethod || "",
      });

      window.location.href = `${APP_RETURN_URL}?${params.toString()}`;
    } else {
      navigate("/corredor/planos");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <img src={logo} alt="RUNLAB" className="h-8" />
        <button
          onClick={async () => {
            await signOut();
            window.location.href = "/";
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[358px] relative">
          {/* Check icon */}
          <div className="flex justify-center mb-[-30px] relative z-10">
            <div className="w-[80px] h-[80px] rounded-full bg-[#1a1a1a] flex items-center justify-center p-[8px]">
              <div className="w-full h-full rounded-full bg-[#CCF725] flex items-center justify-center">
                <Check className="w-9 h-9 text-[#1a1a1a]" strokeWidth={3} />
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[#1a1a1a] rounded-2xl pt-[48px] pb-6 px-4">
            <div className="flex flex-col gap-10">
              {/* Title */}
              <div className="text-center">
                <h1 className="text-2xl font-medium text-[#f5f5f5] leading-7 mb-1">
                  Pagamento confirmado!
                </h1>
                <p className="text-sm text-[#b2b2b2] leading-normal">
                  Seu pagamento foi realizado com sucesso.
                </p>
              </div>

              {/* Details */}
              <div className="flex flex-col gap-2">
                {/* Tipo de cobrança */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#e0e0e0]">
                    Tipo de cobrança
                  </span>
                  <span className="text-base font-medium text-[#CCF725]">
                    {planType}
                  </span>
                </div>

                {/* Plano */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#e0e0e0]">
                    Plano
                  </span>
                  <span className="text-base font-medium text-[#CCF725]">
                    {planName}
                  </span>
                </div>

                {/* Preço */}
                <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
                  <span className="text-sm font-medium text-[#e0e0e0]">
                    Preço
                  </span>
                  <span className="text-base font-medium text-[#e0e0e0]">
                    {formattedAmount}
                  </span>
                </div>

                {/* Total pago */}
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm font-medium text-[#e0e0e0]">
                    Total pago
                  </span>
                  <span className="text-xl font-semibold text-[#CCF725]">
                    {formattedAmount}
                  </span>
                </div>

                {/* Créditos adquiridos */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#262626]">
                  <span className="text-sm font-medium text-[#e0e0e0]">
                    Créditos adquiridos
                  </span>
                  <span className="text-base font-semibold text-[#CCF725]">
                    +{creditsAmount} {creditsAmount === 1 ? "crédito" : "créditos"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-6">
            <Button
              onClick={handleReturnToApp}
              className="w-full bg-[#CCF725] text-black hover:bg-[#CCF725]/90 font-medium h-12 rounded-xl"
            >
              Voltar ao início
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoConfirmado;
