import { Header } from "@/components/Header";
import { FinanceiroTabProvider, FinanceiroTabs, useFinanceiroTab } from "@/components/FinanceiroTabs";
import { FinanceiroOverview } from "@/components/FinanceiroOverview";
import { FinanceiroCompeticoesContent } from "@/components/FinanceiroCompeticoesContent";
import { FinanceiroRecebimentosContent } from "@/components/FinanceiroRecebimentosContent";
import { FinanceiroRepassesContent } from "@/components/FinanceiroRepassesContent";

const FinanceiroContent = () => {
  const { activeTab } = useFinanceiroTab();

  if (activeTab === "overview") {
    return <FinanceiroOverview />;
  }

  if (activeTab === "competitions") {
    return <FinanceiroCompeticoesContent />;
  }

  if (activeTab === "receipts") {
    return <FinanceiroRecebimentosContent />;
  }

  if (activeTab === "transfers") {
    return <FinanceiroRepassesContent />;
  }

  return null;
};

const Financeiro = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8 pt-24">
        <FinanceiroTabProvider>
          <FinanceiroTabs />
          <FinanceiroContent />
        </FinanceiroTabProvider>
      </main>
    </div>
  );
};

export default Financeiro;
