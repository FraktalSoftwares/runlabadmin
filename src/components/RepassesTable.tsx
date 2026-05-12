import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import type { RepasseRow, RepasseStatus } from "@/hooks/useRepasses";

function StatusBadge({ status }: { status: RepasseStatus }) {
  const config: Record<RepasseStatus, { bg: string; text: string; label: string }> = {
    pendente: { bg: "bg-[#FEE59A]", text: "text-[#654C01]", label: "Saque solicitado" },
    em_processamento: { bg: "bg-[#C5CCD3]", text: "text-[#2C333A]", label: "Processando" },
    aprovado: { bg: "bg-[#C5CCD3]", text: "text-[#2C333A]", label: "Processando" },
    pago: { bg: "bg-[#B0E8D1]", text: "text-[#174F38]", label: "Pago" },
    erro: { bg: "bg-[#EEAFAA]", text: "text-[#551611]", label: "Erro" },
    rejeitado: { bg: "bg-[#EEAFAA]", text: "text-[#551611]", label: "Rejeitado" },
    sem_solicitacao: { bg: "bg-[#3A3A3A]", text: "text-[#B2B2B2]", label: "Sem saque pedido" },
  };

  const c = config[status] ?? config.em_processamento;

  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm w-[136px] ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

interface RepassesTableProps {
  rows: RepasseRow[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRowClick: (row: RepasseRow) => void;
}

export const RepassesTable = ({
  rows,
  isLoading,
  isError,
  error,
  onRowClick,
}: RepassesTableProps) => {
  return (
    <div className="rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-[#262626]">
        <h2 className="text-xl font-semibold text-white">
          Repasses para parceiros
        </h2>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 bg-[#262626]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="px-6 py-4 text-destructive text-sm bg-[#262626]">
          {error instanceof Error ? error.message : "Erro ao carregar repasses."}
        </div>
      )}

      {!isLoading && !isError && (
        <Table>
          <TableHeader>
            <TableRow className="bg-[#4D4D4D] hover:bg-[#4D4D4D] border-b border-[#808080]">
              <TableHead className="text-xs font-medium text-[#E0E0E0]">Nome</TableHead>
              <TableHead className="text-xs font-medium text-[#E0E0E0]">Tipo de parceiro</TableHead>
              <TableHead className="text-xs font-medium text-[#E0E0E0]">Comissão acumulada</TableHead>
              <TableHead className="text-xs font-medium text-[#E0E0E0]">Total já repassado</TableHead>
              <TableHead className="text-xs font-medium text-[#E0E0E0]">Último repasse</TableHead>
              <TableHead className="text-xs font-medium text-[#E0E0E0]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="bg-[#262626] hover:bg-[#262626]">
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-12"
                >
                  Nenhum parceiro com comissão ou solicitação de repasse encontrado.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.partnerId}
                  className="border-b border-[#808080] hover:bg-muted/30 transition-colors bg-[#262626] cursor-pointer"
                  onClick={() => onRowClick(row)}
                >
                  <TableCell className="text-sm text-[#E0E0E0]">{row.nome}</TableCell>
                  <TableCell className="text-sm text-[#E0E0E0]">{row.tipoParceiro}</TableCell>
                  <TableCell className="text-sm text-[#CCF725] font-medium">{row.commissionAccruedFormatted}</TableCell>
                  <TableCell className="text-sm text-[#E0E0E0]">{row.paidTotalFormatted}</TableCell>
                  <TableCell className="text-sm text-[#E0E0E0]">{row.ultimoRepasse}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
