import { useState, createContext, useContext, ReactNode } from "react";
import { usePendingWithdrawalsCount } from "@/hooks/useRepasses";

type TabType = "overview" | "competitions" | "receipts" | "transfers";

const FinanceiroTabContext = createContext<{
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}>({
  activeTab: "overview",
  setActiveTab: () => {},
});

export const useFinanceiroTab = () => useContext(FinanceiroTabContext);

export const FinanceiroTabProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  return (
    <FinanceiroTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </FinanceiroTabContext.Provider>
  );
};

const TAB_ITEMS: { key: TabType; label: string }[] = [
  { key: "overview", label: "Visão geral" },
  { key: "competitions", label: "Competições" },
  { key: "receipts", label: "Recebimentos" },
  { key: "transfers", label: "Repasses" },
];

export const FinanceiroTabs = () => {
  const { activeTab, setActiveTab } = useFinanceiroTab();
  const { data: pendingCount = 0 } = usePendingWithdrawalsCount();

  return (
    <div className="mb-8">
      <div className="flex items-center border-b border-border">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 pb-4 text-lg font-medium transition-colors relative ${
              activeTab === tab.key
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "transfers" && pendingCount > 0 && (
              <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500 align-top" />
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
