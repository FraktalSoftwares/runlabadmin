import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { PartnerRow } from "@/hooks/usePartners";

const getStatusVariant = (status: PartnerRow["status"]) => {
  switch (status) {
    case "Ativo":
      return "success";
    case "Em analise":
      return "warning";
    case "Rejeitado":
      return "destructive";
    case "Inativo":
      return "secondary";
    default:
      return "secondary";
  }
};

type PartnersTableProps = {
  partners: PartnerRow[];
  loading?: boolean;
  error?: Error | null;
};

export const PartnersTable = ({ partners, loading, error }: PartnersTableProps) => {
  if (error) {
    return (
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-table-title">
          <h3 className="text-foreground font-semibold">Parceiros</h3>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-destructive text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg overflow-hidden">
      <div className="px-6 py-4 bg-table-title">
        <h3 className="text-foreground font-semibold">Parceiros</h3>
      </div>
      {loading ? (
        <div className="px-6 py-12 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-table-header">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Nome</th>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>E-mail</th>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Telefone</th>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>CPF/CNPJ</th>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Tipo de parceiro</th>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Último acesso</th>
                <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    Nenhum parceiro encontrado.
                  </td>
                </tr>
              ) : (
                partners.map((partner, index) => (
                  <tr
                    key={partner.id}
                    className={`border-t border-border hover:bg-table-row-hover transition-colors cursor-pointer ${
                      index % 2 === 0 ? "bg-table-row" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-foreground">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        {partner.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        {partner.email}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        {partner.phone}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        {partner.cpfCnpj}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        {partner.type}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground whitespace-nowrap">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        {partner.lastAccess}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/parceiros/${partner.id}`} className="block w-full">
                        <Badge variant={getStatusVariant(partner.status)}>{partner.status}</Badge>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
