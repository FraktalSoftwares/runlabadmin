import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/runlab-logo.png";

interface PlanLocationState {
  mode: "plan";
  plan: "avulsa" | "anual";
  paymentMethod: string;
  paymentId: string;
  amount: number;
  planName: string;
  planType: string;
  creditsAmount?: number;
  originalAmount?: number;
  advisorCode?: string;
}

interface LotLocationState {
  mode: "lot";
  paymentMethod: string;
  paymentId: string;
  amount: number;
  originalAmount?: number;
  partnerDiscount?: number;
  runcoinsDiscount?: number;
  runcoinsUsed?: number;
  lotName: string;
  competitionId: string;
  lotId: string;
  distanceId?: string;
}

type LocationState = PlanLocationState | LotLocationState;

const formatAmount = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

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

  const isLotMode = state?.mode === "lot";

  const handleReturnToApp = () => {
    if (isLotMode) {
      const lotState = state as LotLocationState;
      if (APP_RETURN_URL) {
        const params = new URLSearchParams({
          status: "success",
          competitionId: lotState.competitionId,
          lotId: lotState.lotId,
          ...(lotState.distanceId ? { distanceId: lotState.distanceId } : {}),
          amount: String(lotState.amount),
          paymentId: lotState.paymentId,
          paymentMethod: lotState.paymentMethod || "",
        });
        window.location.href = `${APP_RETURN_URL}?${params.toString()}`;
      } else {
        navigate("/corredor/planos");
      }
      return;
    }

    const planState = state as PlanLocationState | null;
    if (APP_RETURN_URL) {
      const plan = planState?.plan || "avulsa";
      const params = new URLSearchParams({
        status: "success",
        plan,
        planName: planState?.planName || PLAN_DEFAULTS[plan].name,
        planType: planState?.planType || PLAN_DEFAULTS[plan].type,
        amount: String(planState?.amount || 0),
        paymentId: planState?.paymentId || "",
        paymentMethod: planState?.paymentMethod || "",
      });
      window.location.href = `${APP_RETURN_URL}?${params.toString()}`;
    } else {
      navigate("/corredor/planos");
    }
  };

  const renderPlanDetails = () => {
    const planState = state as PlanLocationState | null;
    const plan = planState?.plan || "avulsa";
    const defaults = PLAN_DEFAULTS[plan];
    const planName = planState?.planName || defaults.name;
    const planType = planState?.planType || defaults.type;
    const amount = planState?.amount || (plan === "avulsa" ? 59.9 : 610.0);
    const creditsAmount = planState?.creditsAmount || (plan === "anual" ? 12 : 1);

    return (
      <>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#e0e0e0]">Tipo de cobrança</span>
          <span className="text-base font-medium text-[#CCF725]">{planType}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#e0e0e0]">Plano</span>
          <span className="text-base font-medium text-[#CCF725]">{planName}</span>
        </div>
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <span className="text-sm font-medium text-[#e0e0e0]">Preço</span>
          <span className="text-base font-medium text-[#e0e0e0]">{formatAmount(amount)}</span>
        </div>
        <div className="flex items-center justify-between pt-4">
          <span className="text-sm font-medium text-[#e0e0e0]">Total pago</span>
          <span className="text-xl font-semibold text-[#CCF725]">{formatAmount(amount)}</span>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#262626]">
          <span className="text-sm font-medium text-[#e0e0e0]">Créditos adquiridos</span>
          <span className="text-base font-semibold text-[#CCF725]">
            +{creditsAmount} {creditsAmount === 1 ? "crédito" : "créditos"}
          </span>
        </div>
      </>
    );
  };

  const renderLotDetails = () => {
    const lotState = state as LotLocationState;
    const originalAmount = lotState.originalAmount ?? lotState.amount;
    const hasDiscounts = (lotState.partnerDiscount ?? 0) > 0 || (lotState.runcoinsDiscount ?? 0) > 0;

    return (
      <>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[#e0e0e0]">Inscrição</span>
          <span className="text-base font-medium text-[#CCF725]">{lotState.lotName}</span>
        </div>
        <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
          <span className="text-sm font-medium text-[#e0e0e0]">Preço original</span>
          <span className={`text-base font-medium ${hasDiscounts ? "text-[#737373] line-through" : "text-[#e0e0e0]"}`}>
            {formatAmount(originalAmount)}
          </span>
        </div>
        {(lotState.partnerDiscount ?? 0) > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#e0e0e0]">Desc. indicação (10%)</span>
            <span className="text-sm text-green-500">−{formatAmount(lotState.partnerDiscount!)}</span>
          </div>
        )}
        {(lotState.runcoinsDiscount ?? 0) > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#e0e0e0]">
              Desc. Runcoins ({lotState.runcoinsUsed})
            </span>
            <span className="text-sm text-green-500">−{formatAmount(lotState.runcoinsDiscount!)}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-4 border-t border-[#262626]">
          <span className="text-sm font-medium text-[#e0e0e0]">Total pago</span>
          <span className="text-xl font-semibold text-[#CCF725]">{formatAmount(lotState.amount)}</span>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[358px] relative">
          <div className="flex justify-center mb-[-30px] relative z-10">
            <div className="w-[80px] h-[80px] rounded-full bg-[#1a1a1a] flex items-center justify-center p-[8px]">
              <div className="w-full h-full rounded-full bg-[#CCF725] flex items-center justify-center">
                <Check className="w-9 h-9 text-[#1a1a1a]" strokeWidth={3} />
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-2xl pt-[48px] pb-6 px-4">
            <div className="flex flex-col gap-10">
              <div className="text-center">
                <h1 className="text-2xl font-medium text-[#f5f5f5] leading-7 mb-1">
                  Pagamento confirmado!
                </h1>
                <p className="text-sm text-[#b2b2b2] leading-normal">
                  {isLotMode
                    ? "Sua inscrição foi realizada com sucesso."
                    : "Seu pagamento foi realizado com sucesso."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {isLotMode ? renderLotDetails() : renderPlanDetails()}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleReturnToApp}
              className="w-full bg-[#CCF725] text-black hover:bg-[#CCF725]/90 font-medium h-12 rounded-xl"
            >
              {isLotMode ? "Voltar" : "Voltar ao início"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagamentoConfirmado;
