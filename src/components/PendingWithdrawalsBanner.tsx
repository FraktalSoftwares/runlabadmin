import { AlertTriangle, ChevronRight } from "lucide-react";
import { usePendingWithdrawalsCount } from "@/hooks/useRepasses";

interface PendingWithdrawalsBannerProps {
  onClick: () => void;
}

export const PendingWithdrawalsBanner = ({ onClick }: PendingWithdrawalsBannerProps) => {
  const { data: count = 0 } = usePendingWithdrawalsCount();

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl bg-[#CCF725]/15 border border-[#CCF725]/30 text-foreground transition-colors hover:bg-[#CCF725]/20 mb-6"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-[#CCF725] shrink-0" />
        <span className="text-sm font-medium">
          {count === 1
            ? "Existe 1 solicitação de saque de parceiro pendente. Clique aqui para visualizar."
            : `Existem ${count} solicitações de saques de parceiros pendentes. Clique aqui para visualizar.`}
        </span>
      </div>
      <ChevronRight className="h-5 w-5 text-[#CCF725] shrink-0" />
    </button>
  );
};
