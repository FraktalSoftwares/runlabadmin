import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Copy,
  Download,
  Printer,
  ChevronDown,
  Timer,
  Tag,
  X,
  Loader2,
  CheckCircle2,
  Coins,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import logo from "@/assets/runlab-logo.png";

type PaymentMethod = "credito" | "debito" | "pix" | "boleto" | null;

interface LotData {
  id: string;
  name: string;
  priceCents: number;
  competitionTitle: string;
}

const BILLING_TYPE_MAP: Record<string, string> = {
  credito: "CREDIT_CARD",
  debito: "DEBIT_CARD",
  pix: "PIX",
  boleto: "BOLETO",
};

const formatPrice = (value: number) =>
  `R$ ${value.toFixed(2).replace(".", ",")}`;

const APP_RETURN_URL = import.meta.env.VITE_APP_RETURN_URL || "";

// ─── Main Component ─────────────────────────────────────

const CheckoutAvulso = () => {
  const { competitionId } = useParams<{ competitionId: string }>();
  const [searchParams] = useSearchParams();
  const lotId = searchParams.get("lotId");
  const distanceId = searchParams.get("distanceId") || undefined;

  const [lotData, setLotData] = useState<LotData | null>(null);
  const [lotLoading, setLotLoading] = useState(true);
  const [lotError, setLotError] = useState<string | null>(null);

  // Fetch lot + competition data (user já autenticado pelo CorredorGuard)
  useEffect(() => {
    if (!competitionId || !lotId) {
      setLotError("Dados da competição não encontrados.");
      setLotLoading(false);
      return;
    }

    const fetchLotData = async () => {
      setLotLoading(true);
      setLotError(null);
      try {
        const [lotRes, compRes] = await Promise.all([
          supabase
            .from("competition_lots")
            .select("id, name, price_cents")
            .eq("id", lotId)
            .eq("competition_id", competitionId)
            .single(),
          supabase
            .from("competitions")
            .select("title")
            .eq("id", competitionId)
            .single(),
        ]);

        if (lotRes.error || !lotRes.data) {
          setLotError("Lote não encontrado.");
          return;
        }
        if (compRes.error || !compRes.data) {
          setLotError("Competição não encontrada.");
          return;
        }

        setLotData({
          id: lotRes.data.id,
          name: lotRes.data.name,
          priceCents: lotRes.data.price_cents,
          competitionTitle: compRes.data.title,
        });
      } catch {
        setLotError("Erro ao carregar dados.");
      } finally {
        setLotLoading(false);
      }
    };

    fetchLotData();
  }, [competitionId, lotId]);

  if (lotLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (lotError || !lotData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <img src={logo} alt="RUNLAB" className="h-8 mb-8" />
        <p className="text-destructive text-center">{lotError || "Dados não encontrados."}</p>
      </div>
    );
  }

  return (
    <CheckoutForm
      competitionId={competitionId!}
      lotData={lotData}
      distanceId={distanceId}
    />
  );
};

// ─── Checkout Form ──────────────────────────────────────

function CheckoutForm({
  competitionId,
  lotData,
  distanceId,
}: {
  competitionId: string;
  lotData: LotData;
  distanceId?: string;
}) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const basePrice = lotData.priceCents / 100;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Credit card form
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [installments, setInstallments] = useState("1");
  const [phone, setPhone] = useState("");

  // Address form
  const [address, setAddress] = useState({
    logradouro: "",
    numero: "",
    cep: "",
    estado: "",
    cidade: "",
    bairro: "",
    complemento: "",
  });

  // Coupon / advisor code
  const [couponCode, setCouponCode] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponValid, setCouponValid] = useState<boolean | null>(null);
  const [couponPartnerUserId, setCouponPartnerUserId] = useState<string | null>(null);
  const couponDebounce = useRef<ReturnType<typeof setTimeout>>();

  // Runcoins discount
  const totalRuncoins = profile?.total_runcoins ?? 0;
  const [useRuncoins, setUseRuncoins] = useState(false);
  const [runcoinsToUse, setRuncoinsToUse] = useState(0);

  const DISCOUNT_PERCENT = 0.10;
  const discountActive = couponValid === true && couponCode.length > 0;
  const partnerDiscountAmount = discountActive ? basePrice * DISCOUNT_PERCENT : 0;
  const priceAfterPartner = basePrice - partnerDiscountAmount;

  const maxRuncoinsDiscount = Math.min(totalRuncoins, Math.floor(priceAfterPartner * 100) / 100);
  const runcoinsDiscountAmount = useRuncoins ? Math.min(runcoinsToUse, maxRuncoinsDiscount) : 0;
  const finalPrice = Math.max(0, priceAfterPartner - runcoinsDiscountAmount);

  const validateCoupon = useCallback(async (code: string) => {
    if (!code.trim()) {
      setCouponValid(null);
      setCouponCode("");
      setCouponPartnerUserId(null);
      return;
    }
    setCouponLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, referral_code")
        .eq("referral_code", code.trim().toUpperCase())
        .eq("is_partner", true)
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        setCouponValid(false);
        setCouponCode("");
        setCouponPartnerUserId(null);
      } else {
        setCouponValid(true);
        setCouponCode(code.trim().toUpperCase());
        setCouponPartnerUserId(data.id);
      }
    } catch {
      setCouponValid(false);
      setCouponCode("");
      setCouponPartnerUserId(null);
    } finally {
      setCouponLoading(false);
    }
  }, []);

  const handleCouponInputChange = (value: string) => {
    setCouponInput(value);
    setCouponValid(null);
    if (couponDebounce.current) clearTimeout(couponDebounce.current);
    if (!value.trim()) {
      setCouponCode("");
      setCouponPartnerUserId(null);
      return;
    }
    couponDebounce.current = setTimeout(() => validateCoupon(value), 600);
  };

  const handleClearCoupon = () => {
    setCouponInput("");
    setCouponCode("");
    setCouponValid(null);
    setCouponPartnerUserId(null);
    if (couponDebounce.current) clearTimeout(couponDebounce.current);
  };

  // Pre-fill advisor code
  useEffect(() => {
    if (!profile?.advisor_code || couponInput) return;
    setCouponInput(profile.advisor_code);
    validateCoupon(profile.advisor_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.advisor_code]);

  // PIX state
  const [pixData, setPixData] = useState<{
    qrCodeImage: string;
    payload: string;
    expirationDate: string;
  } | null>(null);
  const [pixTimer, setPixTimer] = useState(60);
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);

  // Boleto state
  const [boletoData, setBoletoData] = useState<{
    bankSlipUrl: string;
    dueDate: string;
    invoiceUrl: string;
    nossoNumero: string;
  } | null>(null);

  // Polling
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (useRuncoins) {
      setRuncoinsToUse(Math.min(runcoinsToUse, maxRuncoinsDiscount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxRuncoinsDiscount, useRuncoins]);

  // PIX countdown
  useEffect(() => {
    if (pixData && pixTimer > 0) {
      const timer = setInterval(() => setPixTimer((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [pixData, pixTimer]);

  const buildSuccessState = useCallback(() => ({
    mode: "lot" as const,
    paymentMethod,
    amount: finalPrice,
    originalAmount: basePrice,
    partnerDiscount: partnerDiscountAmount > 0 ? partnerDiscountAmount : undefined,
    runcoinsDiscount: runcoinsDiscountAmount > 0 ? runcoinsDiscountAmount : undefined,
    runcoinsUsed: runcoinsDiscountAmount > 0 ? Math.floor(runcoinsDiscountAmount) : undefined,
    lotName: lotData.name,
    competitionId,
    lotId: lotData.id,
    distanceId,
  }), [paymentMethod, finalPrice, basePrice, partnerDiscountAmount, runcoinsDiscountAmount, lotData, competitionId, distanceId]);

  const handlePaymentSuccess = useCallback((paymentId: string) => {
    const successState = { ...buildSuccessState(), paymentId };
    // Try to return to app via deep link
    if (APP_RETURN_URL) {
      const params = new URLSearchParams({
        status: "success",
        competitionId,
        lotId: lotData.id,
        ...(distanceId ? { distanceId } : {}),
        amount: String(finalPrice),
        paymentId,
        paymentMethod: paymentMethod || "",
      });
      window.location.href = `${APP_RETURN_URL}?${params.toString()}`;
    } else {
      navigate("/corredor/pagamento-confirmado", { state: successState });
    }
  }, [buildSuccessState, competitionId, lotData.id, distanceId, finalPrice, paymentMethod, navigate]);

  const pollPaymentStatus = useCallback(async (paymentId: string) => {
    setIsPolling(true);
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("asaas-payment-status", {
          body: { paymentId },
        });
        if (error) {
          console.error("Status check error:", error);
        }
        if (data?.confirmed) {
          setIsPolling(false);
          handlePaymentSuccess(paymentId);
          return;
        }
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          setIsPolling(false);
          toast.info("O pagamento ainda está pendente. Verifique novamente em alguns instantes.");
        }
      } catch (err) {
        console.error("Poll error:", err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        }
      }
    };

    poll();
  }, [handlePaymentSuccess]);

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 16);
    return numbers.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 4);
    if (numbers.length >= 3) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return numbers;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 14);
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})/, "$1-$2");
  };

  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 8);
    return numbers.replace(/(\d{5})(\d)/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "").slice(0, 11);
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  };

  const buildRequestBody = (billingType: string): Record<string, unknown> => {
    const customer = {
      name: cardName || profile?.full_name || user?.email?.split("@")[0] || "Corredor",
      cpfCnpj: cpfCnpj.replace(/\D/g, ""),
      email: user?.email || "",
      phone: phone.replace(/\D/g, ""),
    };

    const discountFields = discountActive
      ? { advisorCode: couponCode, advisorUserId: couponPartnerUserId, discountPercent: DISCOUNT_PERCENT }
      : {};

    const runcoinsFields = runcoinsDiscountAmount > 0
      ? { runcoinsUsed: Math.floor(runcoinsDiscountAmount) }
      : {};

    return {
      lotId: lotData.id,
      amount: Math.round(finalPrice * 100) / 100,
      description: lotData.name ?? "Inscrição em competição",
      billingType,
      installmentCount: parseInt(installments) || 1,
      customer,
      ...discountFields,
      ...runcoinsFields,
    };
  };

  const handleConfirmPayment = async () => {
    if (!paymentMethod) return;
    const billingType = BILLING_TYPE_MAP[paymentMethod];

    if (paymentMethod === "credito" || paymentMethod === "debito") {
      if (!cardName || !cardNumber || !cardExpiry || !cardCvv || !cpfCnpj) {
        toast.error("Preencha todos os campos do cartão.");
        return;
      }
      if (!phone) {
        toast.error("Informe o telefone.");
        return;
      }
    }

    setIsProcessing(true);

    try {
      const expiryParts = cardExpiry.split("/");
      const expiryMonth = expiryParts[0] || "";
      const expiryYear = expiryParts[1]
        ? (expiryParts[1].length === 2 ? `20${expiryParts[1]}` : expiryParts[1])
        : "";

      const requestBody = buildRequestBody(billingType);

      if (paymentMethod === "credito" || paymentMethod === "debito") {
        requestBody.creditCard = {
          holderName: cardName,
          number: cardNumber.replace(/\s/g, ""),
          expiryMonth,
          expiryYear,
          ccv: cardCvv,
        };
        requestBody.creditCardHolderInfo = {
          name: cardName,
          email: user?.email || "",
          cpfCnpj: cpfCnpj.replace(/\D/g, ""),
          postalCode: address.cep.replace(/\D/g, "") || "00000000",
          addressNumber: address.numero || "0",
          addressComplement: address.complemento || undefined,
          phone: phone.replace(/\D/g, ""),
        };
      }

      const { data, error } = await supabase.functions.invoke("asaas-checkout", {
        body: requestBody,
      });

      if (error) throw new Error(error.message || "Erro ao processar pagamento");
      if (data?.error) throw new Error(data.error);

      if (billingType === "PIX" && data.pix) {
        setPixData(data.pix);
        setPixPaymentId(data.paymentId);
        setPixTimer(60);
        setIsProcessing(false);
        pollPaymentStatus(data.paymentId);
        return;
      }

      if (billingType === "BOLETO" && data.boleto) {
        setBoletoData(data.boleto);
        setIsProcessing(false);
        pollPaymentStatus(data.paymentId);
        return;
      }

      if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
        handlePaymentSuccess(data.paymentId);
      } else if (data.status === "PENDING" || data.status === "AWAITING_RISK_ANALYSIS") {
        toast.info("Pagamento em análise. Você será notificado quando for confirmado.");
        setIsProcessing(false);
      } else {
        throw new Error("Pagamento não foi aprovado. Verifique os dados do cartão.");
      }
    } catch (err) {
      setIsProcessing(false);
      const message = err instanceof Error ? err.message : "Erro ao processar pagamento";
      toast.error(message);
      console.error("Checkout error:", err);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleSelectPix = async () => {
    setPaymentMethod("pix");
    setIsProcessing(true);
    try {
      const requestBody = buildRequestBody("PIX");
      if (!requestBody.customer || !(requestBody.customer as Record<string, string>).cpfCnpj) {
        (requestBody.customer as Record<string, string>).cpfCnpj = "24971563792";
      }
      const { data, error } = await supabase.functions.invoke("asaas-checkout", {
        body: requestBody,
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao gerar PIX");
      if (data.pix) {
        setPixData(data.pix);
        setPixPaymentId(data.paymentId);
        setPixTimer(60);
        pollPaymentStatus(data.paymentId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar PIX";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectBoleto = async () => {
    setPaymentMethod("boleto");
    setIsProcessing(true);
    try {
      const requestBody = buildRequestBody("BOLETO");
      if (!requestBody.customer || !(requestBody.customer as Record<string, string>).cpfCnpj) {
        (requestBody.customer as Record<string, string>).cpfCnpj = "24971563792";
      }
      const { data, error } = await supabase.functions.invoke("asaas-checkout", {
        body: requestBody,
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao gerar boleto");
      if (data.boleto) {
        setBoletoData(data.boleto);
        pollPaymentStatus(data.paymentId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar boleto";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Processing state
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-center px-6 py-4 border-b border-border">
          <img src={logo} alt="RUNLAB" className="h-8" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#CCF725] flex items-center justify-center">
              <Timer className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-2xl font-medium text-[#f5f5f5]">
              Processando pagamento...
            </h2>
            <p className="text-sm text-[#b2b2b2]">
              Isso pode levar alguns segundos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <img src={logo} alt="RUNLAB" className="h-8" />
        <button
          onClick={async () => {
            await signOut();
            window.location.reload();
          }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[400px]">
          {/* Competition + Lot info */}
          <div className="mb-6">
            <p className="text-xs text-[#737373] uppercase tracking-wide mb-1">
              Inscrição avulsa
            </p>
            <h1 className="text-xl font-medium text-foreground mb-1">
              {lotData.competitionTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lotData.name} — {formatPrice(basePrice)}
            </p>
          </div>

          {/* Coupon / Advisor Code */}
          <div className="mb-6">
            <label className="text-sm font-medium text-[#e0e0e0] block mb-2">
              Código de indicação
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
              <Input
                value={couponInput}
                onChange={(e) => handleCouponInputChange(e.target.value)}
                placeholder="Digite o código do parceiro"
                className={`h-12 rounded-xl bg-[#1a1a1a] border text-[#e0e0e0] placeholder:text-[#737373] pl-10 pr-10 ${
                  couponValid === true
                    ? "border-green-500"
                    : couponValid === false
                      ? "border-red-500"
                      : "border-[#262626]"
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {couponLoading ? (
                  <Loader2 className="w-4 h-4 text-[#737373] animate-spin" />
                ) : couponInput ? (
                  <button onClick={handleClearCoupon} className="p-0.5">
                    <X className="w-4 h-4 text-[#b2b2b2] hover:text-[#e0e0e0] transition-colors" />
                  </button>
                ) : null}
              </div>
            </div>
            {couponValid === true && (
              <div className="flex items-center gap-1.5 mt-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <p className="text-xs text-green-500">
                  Cupom aplicado! Desconto de 10% ({formatPrice(partnerDiscountAmount)})
                </p>
              </div>
            )}
            {couponValid === false && (
              <p className="text-xs text-red-400 mt-2">
                Código inválido. Verifique e tente novamente.
              </p>
            )}
            {discountActive && (
              <div className="mt-3 bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#b2b2b2]">Valor após indicação</p>
                  <p className="text-lg font-semibold text-[#CCF725]">
                    {formatPrice(priceAfterPartner)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#737373] line-through">{formatPrice(basePrice)}</p>
                  <p className="text-xs text-green-500">-10%</p>
                </div>
              </div>
            )}
          </div>

          {/* Runcoins Discount */}
          {totalRuncoins > 0 && (
            <div className="mb-6">
              <label className="text-sm font-medium text-[#e0e0e0] block mb-2">
                Desconto com Runcoins
              </label>
              <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-[#CCF725]" />
                    <span className="text-sm text-[#e0e0e0]">
                      Saldo: {totalRuncoins} {totalRuncoins === 1 ? "Runcoin" : "Runcoins"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !useRuncoins;
                      setUseRuncoins(next);
                      if (next) setRuncoinsToUse(Math.floor(maxRuncoinsDiscount));
                      else setRuncoinsToUse(0);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      useRuncoins ? "bg-[#CCF725]" : "bg-[#3a3a3a]"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        useRuncoins ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                {useRuncoins && (
                  <>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setRuncoinsToUse(Math.max(0, runcoinsToUse - 1))}
                        className="w-8 h-8 rounded-lg bg-[#262626] flex items-center justify-center text-[#e0e0e0] hover:bg-[#333] transition-colors"
                        disabled={runcoinsToUse <= 0}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className="flex-1">
                        <input
                          type="range"
                          min={0}
                          max={Math.floor(maxRuncoinsDiscount)}
                          value={runcoinsToUse}
                          onChange={(e) => setRuncoinsToUse(Number(e.target.value))}
                          className="w-full h-1.5 rounded-full appearance-none bg-[#3a3a3a] accent-[#CCF725] cursor-pointer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setRuncoinsToUse(Math.min(Math.floor(maxRuncoinsDiscount), runcoinsToUse + 1))}
                        className="w-8 h-8 rounded-lg bg-[#262626] flex items-center justify-center text-[#e0e0e0] hover:bg-[#333] transition-colors"
                        disabled={runcoinsToUse >= Math.floor(maxRuncoinsDiscount)}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-[#b2b2b2]">
                        Usando {runcoinsToUse} {runcoinsToUse === 1 ? "Runcoin" : "Runcoins"}
                      </span>
                      <span className="text-sm font-medium text-[#CCF725]">
                        −{formatPrice(runcoinsDiscountAmount)}
                      </span>
                    </div>
                    <p className="text-xs text-[#737373] mt-1">
                      Saldo após compra: {totalRuncoins - runcoinsToUse} Runcoins
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Order Summary */}
          {(partnerDiscountAmount > 0 || runcoinsDiscountAmount > 0) && (
            <div className="mb-6 bg-[#1a1a1a] border border-[#262626] rounded-xl p-4">
              <p className="text-sm font-medium text-[#e0e0e0] mb-3">Resumo</p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#b2b2b2]">Preço original</span>
                  <span className="text-sm text-[#e0e0e0]">{formatPrice(basePrice)}</span>
                </div>
                {partnerDiscountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#b2b2b2]">Desc. indicação (10%)</span>
                    <span className="text-sm text-green-500">−{formatPrice(partnerDiscountAmount)}</span>
                  </div>
                )}
                {runcoinsDiscountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#b2b2b2]">Desc. Runcoins ({runcoinsToUse})</span>
                    <span className="text-sm text-green-500">−{formatPrice(runcoinsDiscountAmount)}</span>
                  </div>
                )}
                <div className="border-t border-[#262626] pt-2 mt-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-[#e0e0e0]">Total</span>
                  <span className="text-lg font-semibold text-[#CCF725]">{formatPrice(finalPrice)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Methods */}
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium text-[#e0e0e0]">Método de pagamento</p>

            {/* Credit Card */}
            <PaymentMethodOption
              icon={<CreditCard className="w-5 h-5 text-[#CCF725]" />}
              label="Cartão de crédito"
              selected={paymentMethod === "credito"}
              onSelect={() => { setPaymentMethod("credito"); setPixData(null); setBoletoData(null); }}
            />
            {paymentMethod === "credito" && (
              <CardForm
                paymentLabel="Cartão de crédito"
                effectivePrice={finalPrice}
                maxInstallments={1}
                cardName={cardName} setCardName={setCardName}
                cardNumber={cardNumber} setCardNumber={(v) => setCardNumber(formatCardNumber(v))}
                cardExpiry={cardExpiry} setCardExpiry={(v) => setCardExpiry(formatExpiry(v))}
                cardCvv={cardCvv} setCardCvv={(v) => setCardCvv(v.replace(/\D/g, "").slice(0, 4))}
                cpfCnpj={cpfCnpj} setCpfCnpj={(v) => setCpfCnpj(formatCpf(v))}
                phone={phone} setPhone={(v) => setPhone(formatPhone(v))}
                installments={installments} setInstallments={setInstallments}
                showInstallments={false}
                onConfirm={handleConfirmPayment}
              />
            )}

            {/* Debit Card */}
            <PaymentMethodOption
              icon={<CreditCard className="w-5 h-5 text-[#CCF725]" />}
              label="Cartão de débito"
              selected={paymentMethod === "debito"}
              onSelect={() => { setPaymentMethod("debito"); setPixData(null); setBoletoData(null); }}
            />
            {paymentMethod === "debito" && (
              <div className="flex flex-col gap-4 -mt-2">
                <CardForm
                  paymentLabel="Cartão de débito"
                  effectivePrice={finalPrice}
                  maxInstallments={1}
                  cardName={cardName} setCardName={setCardName}
                  cardNumber={cardNumber} setCardNumber={(v) => setCardNumber(formatCardNumber(v))}
                  cardExpiry={cardExpiry} setCardExpiry={(v) => setCardExpiry(formatExpiry(v))}
                  cardCvv={cardCvv} setCardCvv={(v) => setCardCvv(v.replace(/\D/g, "").slice(0, 4))}
                  cpfCnpj={cpfCnpj} setCpfCnpj={(v) => setCpfCnpj(formatCpf(v))}
                  phone={phone} setPhone={(v) => setPhone(formatPhone(v))}
                  installments={installments} setInstallments={setInstallments}
                  showInstallments={false}
                  onConfirm={handleConfirmPayment}
                  showAddress
                  address={address}
                  setAddress={setAddress}
                  formatCep={formatCep}
                />
              </div>
            )}

            {/* PIX */}
            <PaymentMethodOption
              icon={<PixIcon />}
              label="Pix"
              selected={paymentMethod === "pix"}
              onSelect={pixData ? () => setPaymentMethod("pix") : handleSelectPix}
            />
            {paymentMethod === "pix" && pixData && (
              <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex flex-col gap-4 -mt-2">
                <div>
                  <h3 className="text-base font-medium text-[#e0e0e0] mb-3">
                    Escaneie ou copie este código para pagar
                  </h3>
                  <div className="text-sm text-[#b2b2b2] space-y-1">
                    <p>1. Acesse o app do seu banco</p>
                    <p>2. Escolha pagar com Pix</p>
                    <p>3. Cole o seguinte código:</p>
                  </div>
                </div>
                <div className="flex justify-center py-4">
                  {pixData.qrCodeImage ? (
                    <img
                      src={`data:image/png;base64,${pixData.qrCodeImage}`}
                      alt="QR Code PIX"
                      className="w-40 h-40 rounded-lg"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-[#262626] rounded-lg flex items-center justify-center text-[#737373] text-sm">
                      QR Code
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#CCF725] rounded-xl px-4 py-3">
                  <p className="text-sm text-[#CCF725] flex-1 truncate">{pixData.payload}</p>
                  <button onClick={() => handleCopyCode(pixData.payload)} className="shrink-0">
                    <Copy className="w-4 h-4 text-[#CCF725]" />
                  </button>
                </div>
                {isPolling && (
                  <p className="text-xs text-[#b2b2b2] text-center animate-pulse">
                    Aguardando confirmação do pagamento...
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725]/10 h-12 rounded-xl"
                  disabled={pixTimer > 0}
                  onClick={() => { setPixTimer(60); toast.success("E-mail reenviado!"); }}
                >
                  Reenviar email ({pixTimer}s)
                </Button>
              </div>
            )}

            {/* Boleto */}
            <PaymentMethodOption
              icon={<BarcodeIcon />}
              label="Boleto"
              selected={paymentMethod === "boleto"}
              onSelect={boletoData ? () => setPaymentMethod("boleto") : handleSelectBoleto}
            />
            {paymentMethod === "boleto" && boletoData && (
              <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex flex-col gap-4 -mt-2">
                <p className="text-sm text-[#b2b2b2] text-center">
                  A data de vencimento
                  <br />
                  do seu boleto é{" "}
                  <span className="font-medium text-[#e0e0e0]">
                    {boletoData.dueDate
                      ? new Date(boletoData.dueDate + "T12:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </p>
                {boletoData.invoiceUrl && (
                  <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#CCF725] rounded-xl px-4 py-3">
                    <p className="text-sm text-[#CCF725] flex-1 truncate">
                      {boletoData.nossoNumero || boletoData.invoiceUrl}
                    </p>
                    <button onClick={() => handleCopyCode(boletoData.invoiceUrl)} className="shrink-0">
                      <Copy className="w-4 h-4 text-[#CCF725]" />
                    </button>
                  </div>
                )}
                {isPolling && (
                  <p className="text-xs text-[#b2b2b2] text-center animate-pulse">
                    Aguardando confirmação do pagamento...
                  </p>
                )}
                {boletoData.bankSlipUrl && (
                  <Button
                    variant="outline"
                    className="w-full border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725]/10 h-12 rounded-xl gap-2"
                    onClick={() => window.open(boletoData.bankSlipUrl, "_blank")}
                  >
                    <Download className="w-4 h-4" />
                    Baixar arquivo
                  </Button>
                )}
                {boletoData.invoiceUrl && (
                  <Button
                    variant="outline"
                    className="w-full border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725]/10 h-12 rounded-xl gap-2"
                    onClick={() => window.open(boletoData.invoiceUrl, "_blank")}
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir boleto
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function PaymentMethodOption({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`bg-[#1a1a1a] border rounded-xl py-3 px-4 flex items-center justify-between w-full transition-all ${
        selected ? "border-[#CCF725]" : "border-[#262626]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-[#262626] rounded-full flex items-center justify-center">
          {icon}
        </div>
        <span className="text-base text-[#b2b2b2]">{label}</span>
      </div>
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? "border-[#CCF725]" : "border-[#737373]"
        }`}
      >
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#CCF725]" />}
      </div>
    </button>
  );
}

function CardForm({
  paymentLabel,
  effectivePrice,
  maxInstallments,
  cardName,
  setCardName,
  cardNumber,
  setCardNumber,
  cardExpiry,
  setCardExpiry,
  cardCvv,
  setCardCvv,
  cpfCnpj,
  setCpfCnpj,
  phone,
  setPhone,
  installments,
  setInstallments,
  showInstallments,
  onConfirm,
  showAddress,
  address,
  setAddress,
  formatCep,
}: {
  paymentLabel: string;
  effectivePrice: number;
  maxInstallments: number;
  cardName: string;
  setCardName: (v: string) => void;
  cardNumber: string;
  setCardNumber: (v: string) => void;
  cardExpiry: string;
  setCardExpiry: (v: string) => void;
  cardCvv: string;
  setCardCvv: (v: string) => void;
  cpfCnpj: string;
  setCpfCnpj: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  installments: string;
  setInstallments: (v: string) => void;
  showInstallments: boolean;
  onConfirm: () => void;
  showAddress?: boolean;
  address?: {
    logradouro: string;
    numero: string;
    cep: string;
    estado: string;
    cidade: string;
    bairro: string;
    complemento: string;
  };
  setAddress?: React.Dispatch<
    React.SetStateAction<{
      logradouro: string;
      numero: string;
      cep: string;
      estado: string;
      cidade: string;
      bairro: string;
      complemento: string;
    }>
  >;
  formatCep?: (v: string) => string;
}) {
  return (
    <div className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-4 flex flex-col gap-4 -mt-2">
      <p className="text-xs text-[#b2b2b2]">Informações do {paymentLabel.toLowerCase()}</p>

      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Método de pagamento</label>
        <div className="relative">
          <select
            className="w-full h-12 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#e0e0e0] px-4 pr-10 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#CCF725]"
            defaultValue={paymentLabel === "Cartão de crédito" ? "credito" : "debito"}
          >
            <option value={paymentLabel === "Cartão de crédito" ? "credito" : "debito"}>
              {paymentLabel}
            </option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b2b2b2] pointer-events-none" />
        </div>
      </div>

      {showInstallments && (
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Número de parcelas</label>
          <div className="relative">
            <select
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="w-full h-12 rounded-xl bg-[#1a1a1a] border border-[#262626] text-[#e0e0e0] px-4 pr-10 text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-[#CCF725]"
            >
              <option value="1">
                1x de {formatPrice(effectivePrice)} (parcela única)
              </option>
              {maxInstallments > 1 &&
                Array.from({ length: maxInstallments - 1 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={String(n)}>
                    {n}x de R$ {(effectivePrice / n).toFixed(2).replace(".", ",")}
                  </option>
                ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b2b2b2] pointer-events-none" />
          </div>
        </div>
      )}

      <p className="text-xs text-[#b2b2b2]">Dados do cartão</p>

      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Nome do cartão</label>
        <Input
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="Matheus Rodrigues Silva"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Número do cartão</label>
        <Input
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          placeholder="0110 1624 2432 6472"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Validade</label>
          <Input
            value={cardExpiry}
            onChange={(e) => setCardExpiry(e.target.value)}
            placeholder="06/28"
            className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">CVV</label>
          <Input
            value={cardCvv}
            onChange={(e) => setCardCvv(e.target.value)}
            placeholder="452"
            className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">CPF/CNPJ</label>
        <Input
          value={cpfCnpj}
          onChange={(e) => setCpfCnpj(e.target.value)}
          placeholder="123.456.678-99"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Telefone</label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(11) 99999-9999"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>

      {showAddress && address && setAddress && formatCep && (
        <AddressForm address={address} setAddress={setAddress} formatCep={formatCep} />
      )}

      <Button
        onClick={onConfirm}
        className="w-full bg-[#CCF725] text-black hover:bg-[#CCF725]/90 font-medium h-12 rounded-xl mt-2"
      >
        Confirmar pagamento
      </Button>

      <div className="text-xs text-[#737373] space-y-1">
        <p className="font-medium text-[#b2b2b2]">Política de Cancelamento</p>
        <p>• Cancelamento até 12h antes: reembolso integral</p>
        <p>• Cancelamento após 12h antes: sem reembolso</p>
        <p>• Reagendamento permitido até 2h antes</p>
      </div>
    </div>
  );
}

function AddressForm({
  address,
  setAddress,
  formatCep,
}: {
  address: {
    logradouro: string;
    numero: string;
    cep: string;
    estado: string;
    cidade: string;
    bairro: string;
    complemento: string;
  };
  setAddress: React.Dispatch<
    React.SetStateAction<{
      logradouro: string;
      numero: string;
      cep: string;
      estado: string;
      cidade: string;
      bairro: string;
      complemento: string;
    }>
  >;
  formatCep: (value: string) => string;
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <p className="text-sm font-medium text-[#e0e0e0]">Endereço de cobrança</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Logradouro</label>
          <Input
            value={address.logradouro}
            onChange={(e) => setAddress((prev) => ({ ...prev, logradouro: e.target.value }))}
            placeholder="Ex: Rua rego freitas"
            className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Número</label>
          <Input
            value={address.numero}
            onChange={(e) => setAddress((prev) => ({ ...prev, numero: e.target.value }))}
            placeholder="Ex: 452"
            className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">CEP</label>
          <Input
            value={address.cep}
            onChange={(e) => setAddress((prev) => ({ ...prev, cep: formatCep(e.target.value) }))}
            placeholder="00000-000"
            className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Estado</label>
          <Input
            value={address.estado}
            onChange={(e) => setAddress((prev) => ({ ...prev, estado: e.target.value }))}
            placeholder="Ex: SP"
            className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Cidade</label>
        <Input
          value={address.cidade}
          onChange={(e) => setAddress((prev) => ({ ...prev, cidade: e.target.value }))}
          placeholder="Ex: São Paulo"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Bairro</label>
        <Input
          value={address.bairro}
          onChange={(e) => setAddress((prev) => ({ ...prev, bairro: e.target.value }))}
          placeholder="Ex: Vila Madalena"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-[#e0e0e0] block mb-2">Complemento</label>
        <Input
          value={address.complemento}
          onChange={(e) => setAddress((prev) => ({ ...prev, complemento: e.target.value }))}
          placeholder="Ex: Apto 2006"
          className="h-12 rounded-xl bg-[#1a1a1a] border-[#262626] text-[#e0e0e0] placeholder:text-[#737373]"
        />
      </div>
    </div>
  );
}

function PixIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.5 5.5L10 10L5.5 5.5" stroke="#CCF725" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(45, 10, 10)" />
      <path d="M5.5 14.5L10 10L14.5 14.5" stroke="#CCF725" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(45, 10, 10)" />
    </svg>
  );
}

function BarcodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="1.5" height="12" fill="#CCF725" />
      <rect x="5" y="4" width="1" height="12" fill="#CCF725" />
      <rect x="7.5" y="4" width="2" height="12" fill="#CCF725" />
      <rect x="11" y="4" width="1" height="12" fill="#CCF725" />
      <rect x="13.5" y="4" width="1.5" height="12" fill="#CCF725" />
      <rect x="16.5" y="4" width="1.5" height="12" fill="#CCF725" />
    </svg>
  );
}

export default CheckoutAvulso;
