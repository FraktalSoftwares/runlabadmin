import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePlans, formatPrice, type Plan } from "@/hooks/usePlans";
import logo from "@/assets/runlab-logo.png";

const PlanoSelecao = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { plans, loading } = usePlans();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const handleContinue = () => {
    if (!selectedPlan) return;
    navigate("/corredor/checkout", {
      state: { planId: selectedPlan.id },
    });
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
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 md:py-12">
        <div className="w-full max-w-[780px]">
          <h1 className="text-2xl font-medium text-foreground mb-2">
            Planos e preços
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Escolha o plano ideal para você
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground animate-pulse">
                Carregando planos...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlanId === plan.id}
                  onSelect={() => setSelectedPlanId(plan.id)}
                />
              ))}
            </div>
          )}

          {/* Continue Button */}
          <div className="mt-8">
            <Button
              onClick={handleContinue}
              disabled={!selectedPlan}
              className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-12"
              size="lg"
            >
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const isHighlight = plan.highlight;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-2xl p-6 flex flex-col gap-2 transition-all ${
        isHighlight
          ? selected
            ? "bg-[#CCF725] border-[1.5px] border-[#262626]"
            : "bg-[#CCF725] border border-transparent"
          : selected
            ? "bg-[#1a1a1a] border-[1.5px] border-[#CCF725]"
            : "bg-[#1a1a1a] border border-[#262626]"
      }`}
    >
      {/* Top section */}
      <div
        className={`pb-6 flex flex-col gap-4 w-full ${
          isHighlight
            ? "border-b border-[#121212]/30"
            : "border-b border-[#4d4d4d]"
        }`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <p
                className={`text-lg font-medium leading-snug ${
                  isHighlight ? "text-[#121212]" : "text-[#e0e0e0]"
                }`}
              >
                {plan.name}
              </p>
              {plan.subtitle && (
                <p
                  className={`text-sm leading-snug ${
                    isHighlight ? "text-[#121212]" : "text-[#e0e0e0]"
                  }`}
                >
                  {plan.subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center justify-center w-10 h-10">
              <div
                className={`w-4 h-4 rounded-sm border-[1.5px] flex items-center justify-center ${
                  isHighlight
                    ? selected
                      ? "bg-[#121212] border-[#121212]"
                      : "border-[#121212]"
                    : selected
                      ? "bg-[#CCF725] border-[#CCF725]"
                      : "border-[#737373]"
                }`}
              >
                {selected && (
                  <Check
                    className={`w-3 h-3 ${
                      isHighlight ? "text-[#CCF725]" : "text-black"
                    }`}
                    strokeWidth={3}
                  />
                )}
              </div>
            </div>
          </div>
          {plan.description && (
            <p
              className={`text-sm italic leading-snug ${
                isHighlight ? "text-[#121212]" : "text-[#b2b2b2]"
              }`}
            >
              {plan.description}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="flex flex-col">
          {plan.installments_count > 1 && plan.installment_value ? (
            <>
              <div className="flex items-end gap-1">
                <p
                  className={`text-sm leading-snug ${
                    isHighlight ? "text-[#121212]" : "text-[#e0e0e0]"
                  }`}
                >
                  {plan.installments_count}x
                </p>
                <p
                  className={`text-2xl font-semibold leading-snug ${
                    isHighlight ? "text-[#121212]" : "text-[#CCF725]"
                  }`}
                >
                  {formatPrice(plan.installment_value)}
                </p>
              </div>
              <p
                className={`text-sm leading-snug ${
                  isHighlight ? "text-[#121212]" : "text-[#e0e0e0]"
                }`}
              >
                ({formatPrice(plan.price)})
              </p>
            </>
          ) : (
            <p
              className={`text-2xl font-semibold leading-snug ${
                isHighlight ? "text-[#121212]" : "text-[#CCF725]"
              }`}
            >
              {formatPrice(plan.price)}
            </p>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="flex flex-col gap-2 pt-6">
        {plan.features.map((feature, i) => (
          <PlanFeatureItem
            key={i}
            text={feature}
            variant={isHighlight ? "light" : "dark"}
          />
        ))}
      </div>
    </button>
  );
}

function PlanFeatureItem({
  text,
  variant,
}: {
  text: string;
  variant: "dark" | "light";
}) {
  return (
    <div className="flex gap-2 items-start">
      <div className="shrink-0 mt-0.5">
        <Check
          className={`w-5 h-5 ${
            variant === "dark" ? "text-[#CCF725]" : "text-[#121212]"
          }`}
          strokeWidth={2}
        />
      </div>
      <p
        className={`text-base leading-normal ${
          variant === "dark" ? "text-[#b2b2b2]" : "text-[#121212]"
        }`}
      >
        {text}
      </p>
    </div>
  );
}

export default PlanoSelecao;
