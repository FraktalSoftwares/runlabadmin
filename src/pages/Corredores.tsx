import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { CorredoresActions } from "@/components/CorredoresActions";
import { CorredoresTable } from "@/components/CorredoresTable";
import { Pagination } from "@/components/Pagination";
import { CorredoresFilterProvider, useCorredoresFilters } from "@/contexts/CorredoresFilterContext";
import { useCorredores } from "@/hooks/useCorredores";

const PAGE_SIZE = 10;

function CorredoresContent() {
  const { filters } = useCorredoresFilters();
  const [page, setPage] = useState(1);
  const { data, total, loading, error, refetch } = useCorredores(filters, page, PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [
    filters.search,
    filters.eParceiro,
    filters.naoEParceiro,
    filters.preferredDistance,
    filters.participacaoMin,
    filters.plano,
    filters.cidade,
    filters.estado,
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-8 pt-24">
        <CorredoresActions />
        <CorredoresTable
          data={data}
          loading={loading}
          error={error}
          refetch={refetch}
        />
        {!loading && !error && total > 0 && (
          <Pagination
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        )}
      </main>
    </div>
  );
}

const Corredores = () => (
  <CorredoresFilterProvider>
    <CorredoresContent />
  </CorredoresFilterProvider>
);

export default Corredores;
