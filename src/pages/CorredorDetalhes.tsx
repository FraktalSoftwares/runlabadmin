import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, ChevronLeft, Loader2, Ticket, ExternalLink } from "lucide-react";
import nivelIcon from "@/assets/nivel-icon.png";
import { Button } from "@/components/ui/button";
import { useCorredorDetails } from "@/hooks/useCorredorDetails";

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return (
    date.toLocaleDateString("pt-BR") +
    " " +
    date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

function formatDateOnly(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Paga",
  RECEIVED: "Recebida",
  OVERDUE: "Vencida",
  REFUNDED: "Reembolsada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

const CREDIT_TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  usage: "Uso em desafio",
  refund: "Reembolso",
  expiration: "Expiração",
  admin_adjustment: "Ajuste admin",
};

const CorredorDetalhes = () => {
  const { id } = useParams();
  const { data: corredor, loading, error } = useCorredorDetails(id);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8 pt-24 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (error || !corredor) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8 pt-24">
          <div className="mt-16 mb-6">
            <Link to="/corredores">
              <Button className="gap-2 border-0 hover:brightness-90 transition-all" style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}>
                <ChevronLeft className="w-5 h-5" />
                Voltar
              </Button>
            </Link>
          </div>
          <p className="text-destructive">{error?.message ?? "Corredor não encontrado."}</p>
        </main>
      </div>
    );
  }

  const confirmedPayments = corredor.payments.filter(
    (p) => p.status === "CONFIRMED" || p.status === "RECEIVED"
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-6 py-8 pt-24">
        <div className="mt-16 mb-6">
          <Link to="/corredores">
            <Button className="gap-2 border-0 hover:brightness-90 transition-all" style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}>
              <ChevronLeft className="w-5 h-5" />
              Voltar
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/corredores" className="hover:text-foreground">
            Corredores
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{corredor.name}</span>
        </div>

        <h1 className="text-2xl font-semibold text-foreground/40 mb-6">Dados do usuário</h1>

        <Card className="mb-6 bg-[#2a2a2a] border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="rounded-full bg-[#d4af37] overflow-hidden flex-shrink-0" style={{ width: "140px", height: "140px" }}>
                  {corredor.avatar ? (
                    <img src={corredor.avatar} alt={corredor.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-[#1a1a1a]">
                      {corredor.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={corredor.tier.imageUrl ?? nivelIcon}
                      alt={corredor.tier.name}
                      className="w-10 h-10 object-contain"
                    />
                    <span className="text-sm text-success uppercase tracking-wide">
                      {corredor.tier.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      • {corredor.tier.xp.toLocaleString("pt-BR")} XP
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{corredor.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    <span className="text-xs">E-mail: </span>
                    {corredor.email}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {corredor.isPartner ? "CORREDOR E PARCEIRO" : "CORREDOR"}
                  </p>
                  {corredor.isPartner && (
                    <Link to={`/parceiros/${corredor.id}`}>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-1 gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ver perfil de parceiro
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
              <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                {corredor.plan}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-start">
          <Card className="bg-[#2a2a2a] border-0">
            <CardContent className="p-6 space-y-4 divide-y divide-border">
              <div className="pt-0">
                <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                <p className="text-sm text-foreground">{corredor.email}</p>
              </div>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                <p className="text-sm text-foreground">{corredor.phone}</p>
              </div>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Data de nascimento</p>
                <p className="text-sm text-foreground">{corredor.birthDate}</p>
              </div>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Cidade / Estado</p>
                <p className="text-sm text-foreground">
                  {corredor.city === "—" && corredor.state === "—"
                    ? "—"
                    : [corredor.city, corredor.state].filter((v) => v && v !== "—").join(" / ")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#2a2a2a] border-0">
            <CardContent className="p-6 space-y-4 divide-y divide-border">
              <div className="pt-0">
                <p className="text-xs text-muted-foreground mb-1">Sexo</p>
                <p className="text-sm text-foreground">{corredor.gender}</p>
              </div>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Modalidade preferida</p>
                <p className="text-sm text-foreground">{corredor.modality}</p>
              </div>
              <div className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Último acesso</p>
                <p className="text-sm text-foreground">{corredor.lastAccess}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Saldo de Créditos */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Saldo de créditos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-[#CCF725]/20 flex items-center justify-center">
                    <Ticket className="w-4 h-4 text-[#CCF725]" />
                  </div>
                  <p className="text-xs text-muted-foreground">Créditos disponíveis</p>
                </div>
                <p className="text-3xl font-bold text-[#CCF725]">{corredor.creditBalance}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-2">Nº de provas concluídas</p>
                <p className="text-3xl font-bold text-foreground">{corredor.stats.provasConcluidas}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-2">Nº de inscrições em provas</p>
                <p className="text-3xl font-bold text-foreground">{corredor.stats.assinaturas}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Histórico de Créditos */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Histórico de créditos</h2>
          <Card className="bg-card border-0 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Data</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Tipo</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Descrição</th>
                    <th className="px-6 py-3 text-right text-sm font-medium" style={{ color: "#E0E0E0" }}>Créditos</th>
                  </tr>
                </thead>
                <tbody>
                  {corredor.creditTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        Nenhuma movimentação de créditos.
                      </td>
                    </tr>
                  ) : (
                    corredor.creditTransactions.map((ct, index) => (
                      <tr
                        key={ct.id}
                        className={`border-t border-border ${index % 2 === 0 ? "bg-table-row" : ""}`}
                      >
                        <td className="px-6 py-4 text-sm text-foreground">{formatDateTime(ct.created_at)}</td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {CREDIT_TYPE_LABELS[ct.type] || ct.type}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">{ct.description || "—"}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium">
                          <span className={ct.amount > 0 ? "text-green-400" : "text-red-400"}>
                            {ct.amount > 0 ? "+" : ""}{ct.amount}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Planos contratados */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Planos contratados</h2>
          <Card className="bg-card border-0 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Nome</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Tipo</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Valor pago</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Forma de pagamento</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        Nenhum plano contratado.
                      </td>
                    </tr>
                  ) : (
                    confirmedPayments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        className={`border-t border-border ${index % 2 === 0 ? "bg-table-row" : ""}`}
                      >
                        <td className="px-6 py-4 text-sm text-foreground">{payment.plan_name}</td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {payment.plan_type === "anual" ? "Assinatura" : "Avulso"}
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">{formatPrice(payment.amount)}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{payment.billing_type}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{formatDateOnly(payment.paid_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Cobranças realizadas */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Cobranças realizadas</h2>
          <Card className="bg-card border-0 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Plano</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Forma de pagamento</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Parcelas</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Data</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Data pgto.</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Valor</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: "#E0E0E0" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {corredor.payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        Nenhuma cobrança registrada.
                      </td>
                    </tr>
                  ) : (
                    corredor.payments.map((payment, index) => (
                      <tr
                        key={payment.id}
                        className={`border-t border-border ${index % 2 === 0 ? "bg-table-row" : ""}`}
                      >
                        <td className="px-6 py-4 text-sm text-foreground">{payment.plan_name}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{payment.billing_type}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{payment.installment_count || 1}x</td>
                        <td className="px-6 py-4 text-sm text-foreground">{formatDateOnly(payment.created_at)}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{formatDateOnly(payment.paid_at)}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{formatPrice(payment.amount)}</td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              payment.status === "CONFIRMED" || payment.status === "RECEIVED"
                                ? "success"
                                : payment.status === "PENDING"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {STATUS_LABELS[payment.status] || payment.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CorredorDetalhes;
