import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { usePartnerRequests } from "@/hooks/usePartnerRequests";
import { AceitarParceiroDialog } from "@/components/AceitarParceiroDialog";
import { RecusarParceiroDialog } from "@/components/RecusarParceiroDialog";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const PartnersRequestsTable = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { data: partnerRequests, loading, error, refetch } = usePartnerRequests();
  const canApprovePartners = hasPermission("usuarios.approve_partners");
  const [isAceitarDialogOpen, setIsAceitarDialogOpen] = useState(false);
  const [isRecusarDialogOpen, setIsRecusarDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<{ id: string; user_id: string; name: string } | null>(null);

  const handleAccept = (e: React.MouseEvent, id: string, user_id: string, name: string) => {
    e.stopPropagation();
    setSelectedPartner({ id, user_id, name });
    setIsAceitarDialogOpen(true);
  };

  const handleConfirmAccept = async (dataInicio?: Date, dataFim?: Date) => {
    if (!selectedPartner) return;
    try {
      // Perfil e solicitação na mesma transação: aprovar em dois passos deixava
      // a parceria aprovada com o perfil ainda como Corredor.
      const { error } = await supabase.rpc("admin_approve_partnership", {
        p_request_id: selectedPartner.id,
        p_valid_from: dataInicio ? dataInicio.toISOString() : null,
        p_valid_until: dataFim ? dataFim.toISOString() : null,
      });

      if (error) throw new Error(error.message);

      toast.success(`Solicitação de ${selectedPartner.name} aceita com sucesso!`);
      setIsAceitarDialogOpen(false);
      setSelectedPartner(null);
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao aceitar parceria.";
      toast.error(msg);
    }
  };

  const handleReject = (e: React.MouseEvent, id: string, user_id: string, name: string) => {
    e.stopPropagation();
    setSelectedPartner({ id, user_id, name });
    setIsRecusarDialogOpen(true);
  };

  const handleConfirmReject = async (motivo: string) => {
    if (!selectedPartner) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("partnership_requests")
        .update({ status: "rejected", updated_at: now })
        .eq("id", selectedPartner.id);

      if (error) throw error;

      toast.error(`Solicitação de ${selectedPartner.name} recusada.`);
      setIsRecusarDialogOpen(false);
      setSelectedPartner(null);
      refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao recusar parceria.";
      toast.error(msg);
    }
  };

  if (error) {
    return (
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-table-title">
          <h3 className="text-foreground font-semibold">Solicitações de novos parceiros</h3>
        </div>
        <div className="px-6 py-8 text-center">
          <p className="text-destructive text-sm">{error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-table-title">
          <h3 className="text-foreground font-semibold">Solicitações de novos parceiros</h3>
        </div>
        {loading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">
            Carregando solicitações...
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
                  <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Data de solicitação</th>
                  <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Solicitações</th>
                </tr>
              </thead>
              <tbody>
                {partnerRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">
                      Nenhuma solicitação pendente.
                    </td>
                  </tr>
                ) : (
                  partnerRequests.map((request, index) => (
                    <tr
                      key={request.id}
                      onClick={() => navigate(`/parceiros/${request.user_id}`)}
                      className={`border-t border-border hover:bg-table-row-hover transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-table-row" : ""
                      }`}
                    >
                      <td className="px-6 py-4 text-sm text-foreground">{request.name}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{request.email}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{request.phone}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{request.cpfCnpj}</td>
                      <td className="px-6 py-4 text-sm text-foreground">{request.type}</td>
                      <td className="px-6 py-4 text-sm text-foreground whitespace-nowrap">{request.requestDate}</td>
                      <td className="px-6 py-4">
                        {canApprovePartners ? (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleAccept(e, request.id, request.user_id, request.name)}
                              className="h-7 text-xs border-success text-success hover:bg-success/10"
                            >
                              Aceitar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleReject(e, request.id, request.user_id, request.name)}
                              className="h-7 text-xs bg-[#1A1A1A] text-foreground hover:bg-[#252525] hover:text-foreground"
                            >
                              Recusar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aceitar Parceiro Dialog */}
      <AceitarParceiroDialog
        open={isAceitarDialogOpen}
        onOpenChange={setIsAceitarDialogOpen}
        parceiroNome={selectedPartner?.name}
        onConfirm={handleConfirmAccept}
      />

      {/* Recusar Parceiro Dialog */}
      <RecusarParceiroDialog
        open={isRecusarDialogOpen}
        onOpenChange={setIsRecusarDialogOpen}
        parceiroNome={selectedPartner?.name}
        onConfirm={handleConfirmReject}
      />
    </>
  );
};
