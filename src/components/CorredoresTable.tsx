import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import type { CorredorRow } from "@/hooks/useCorredores";

const getPlanoBadge = (plano: string) => {
  const p = plano?.trim() ?? "";
  if (p === "Gratuito" || p === "") return <Badge className="bg-success/20 text-success-foreground hover:bg-success/20">Gratuito</Badge>;
  return <Badge variant="secondary">{p} crédito{p === "1" ? "" : "s"}</Badge>;
};

type CorredoresTableProps = {
  data: CorredorRow[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

export const CorredoresTable = ({ data, loading, error, refetch }: CorredoresTableProps) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="px-6 py-4 bg-[#262626]">
        <h2 className="text-xl font-semibold text-foreground">Corredores</h2>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="px-6 py-4 text-destructive text-sm">
          {error.message}
        </div>
      )}

      {!loading && !error && (
        <Table>
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header">
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Nome</TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>E-mail</TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Telefone</TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Preferência</TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Vínculo RunLab</TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Último acesso</TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Plano</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  Nenhum corredor encontrado.
                </TableCell>
              </TableRow>
            ) : (
              data.map((corredor) => (
                <TableRow
                  key={corredor.id}
                  className="border-border hover:bg-muted/50 cursor-pointer bg-[#262626]"
                  onClick={() => navigate(`/corredores/${corredor.id}`)}
                >
                  <TableCell className="font-medium text-foreground">{corredor.nome}</TableCell>
                  <TableCell className="text-foreground">{corredor.email}</TableCell>
                  <TableCell className="text-foreground">{corredor.telefone}</TableCell>
                  <TableCell className="text-foreground">{corredor.preferencia}</TableCell>
                  <TableCell className="text-foreground">{corredor.vinculo}</TableCell>
                  <TableCell className="text-foreground">{corredor.ultimoAcesso}</TableCell>
                  <TableCell>{getPlanoBadge(corredor.plano)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
