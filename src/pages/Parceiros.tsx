import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { PartnersTabs } from "@/components/PartnersTabs";
import { PartnersActions } from "@/components/PartnersActions";
import { PartnersTable } from "@/components/PartnersTable";
import { PartnersRequestsTable } from "@/components/PartnersRequestsTable";
import { Pagination } from "@/components/Pagination";
import { usePartners } from "@/hooks/usePartners";
import type { PartnersFilterValues } from "@/components/PartnersFilterDialog";

const PAGE_SIZE = 10;

const Parceiros = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"partners" | "requests">("partners");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerPage, setPartnerPage] = useState(1);
  const [filters, setFilters] = useState<PartnersFilterValues>({ status: "", type: "" });

  const { data: partners, total: partnersTotal, loading: partnersLoading, error: partnersError } = usePartners(
    { search: partnerSearch, status: filters.status || undefined, type: filters.type || undefined },
    partnerPage,
    PAGE_SIZE
  );

  useEffect(() => {
    setPartnerPage(1);
  }, [partnerSearch, filters]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "requests") {
      setActiveTab("requests");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8 pt-24">
        <PartnersTabs activeTab={activeTab} onTabChange={setActiveTab} />
        {activeTab === "partners" ? (
          <>
            <PartnersActions
              search={partnerSearch}
              onSearchChange={setPartnerSearch}
              partners={partners}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <PartnersTable partners={partners} loading={partnersLoading} error={partnersError} />
            <Pagination total={partnersTotal} page={partnerPage} pageSize={PAGE_SIZE} onPageChange={setPartnerPage} />
          </>
        ) : (
          <>
            <PartnersRequestsTable />
            <Pagination />
          </>
        )}
      </main>
    </div>
  );
};

export default Parceiros;
