import { useState } from "react";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, X, ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CorredorProfileDialog } from "@/components/CorredorProfileDialog";
import { InativarParceiroDialog } from "@/components/InativarParceiroDialog";
import { useToast } from "@/hooks/use-toast";
import { useParceiroDetails } from "@/hooks/useParceiroDetails";
import { supabase } from "@/lib/supabase";

const ParceiroDetalhes = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { data: parceiro, loading, error, refetch } = useParceiroDetails(id);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [isInativarDialogOpen, setIsInativarDialogOpen] = useState(false);

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

  if (error || !parceiro) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8 pt-24">
          <div className="mt-16 mb-6">
            <Link to="/parceiros">
              <Button className="gap-2 border-0 hover:brightness-90 transition-all" style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}>
                <ChevronLeft className="w-5 h-5" />
                Voltar
              </Button>
            </Link>
          </div>
          <p className="text-destructive">{error?.message ?? "Parceiro não encontrado."}</p>
        </main>
      </div>
    );
  }

  const repasses: { data: string; valor: string; descricao: string; status: string }[] = [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8 pt-24">
        {/* Back Button */}
        <div className="mt-16 mb-6">
          <Link to="/parceiros">
            <Button 
              className="gap-2 border-0 hover:brightness-90 transition-all" 
              style={{ backgroundColor: '#1A1A1A', color: '#CCF725' }}
            >
              <ChevronLeft className="w-5 h-5" />
              Voltar
            </Button>
          </Link>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/parceiros" className="hover:text-foreground">
            Parceiros
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{parceiro.name}</span>
        </div>

        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-foreground/40">Dados do parceiro</h1>
          <Button 
            onClick={() => setIsProfileDialogOpen(true)}
            className="gap-2 border-0 hover:brightness-90 transition-all" 
            style={{ backgroundColor: '#1A1A1A', color: '#CCF725' }}
          >
            Visualizar perfil de corredor
          </Button>
        </div>

        {/* Main Profile Card */}
        <Card className="mb-6 bg-[#2a2a2a] border-0">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="rounded-full bg-[#d4af37] overflow-hidden flex-shrink-0 w-[140px] h-[140px]">
                  {parceiro.avatar ? (
                    <img src={parceiro.avatar} alt={parceiro.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-foreground/60 font-semibold">
                      {parceiro.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {parceiro.levelInfo ? (
                      <>
                        {parceiro.levelInfo.badge_image_url ? (
                          <img src={parceiro.levelInfo.badge_image_url} alt={parceiro.levelInfo.name} className="w-10 h-10 object-contain" />
                        ) : (
                          <span className="text-lg text-success">★</span>
                        )}
                        <span className="text-sm text-success font-medium">NÍVEL {parceiro.levelInfo.name}</span>
                      </>
                    ) : (
                      <span className="text-sm text-success font-medium">NÍVEL {parceiro.nivel}</span>
                    )}
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">{parceiro.name}</h2>
                  {(parceiro.city !== "—" || parceiro.state !== "—") && (
                    <p className="text-sm text-muted-foreground">
                      {[parceiro.city, parceiro.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{parceiro.type}</p>
                </div>
              </div>
              <Badge 
                variant="default" 
                className={
                  parceiro.status === "Ativo" 
                    ? "bg-success hover:bg-success" 
                    : "bg-destructive hover:bg-destructive"
                }
              >
                {parceiro.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mb-6 bg-[#2a2a2a] border-0">
          <CardContent className="p-6 space-y-4 divide-y divide-border">
            <div className="pt-0">
              <p className="text-xs text-muted-foreground mb-1">E-mail</p>
              <p className="text-sm text-foreground">{parceiro.email}</p>
            </div>
            <div className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Telefone</p>
              <p className="text-sm text-foreground">{parceiro.phone}</p>
            </div>
            <div className="pt-4">
              <p className="text-xs text-muted-foreground mb-1">Último acesso</p>
              <p className="text-sm text-foreground">{parceiro.lastAccess}</p>
            </div>
            <div className="pt-4">
              <p className="text-xs text-muted-foreground mb-3">Data de parceria</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] rounded-lg px-4 py-3">
                  <p className="text-sm text-foreground">
                    <span className="text-xs text-muted-foreground">De: </span>{parceiro.cadastro}
                  </p>
                </div>
                <div className="bg-[#1A1A1A] rounded-lg px-4 py-3">
                  <p className="text-sm text-foreground">
                    <span className="text-xs text-muted-foreground">Até: </span>—
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Data Card */}
        <div className="mb-6">
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setIsInativarDialogOpen(true)}
              className="gap-2 border-0 hover:brightness-90 transition-all" 
              style={{ backgroundColor: '#1A1A1A', color: '#808080' }}
            >
              <X className="w-4 h-4" />
              Inativar parceiro
            </Button>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Dados do formulário enviado</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card */}
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6 space-y-4 divide-y divide-border">
                <div className="pt-0">
                  <p className="text-xs text-muted-foreground mb-1">Instagram</p>
                  <p className="text-sm text-foreground">{parceiro.formData.instagram}</p>
                </div>
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Link</p>
                  <p className="text-sm text-foreground">{parceiro.formData.link}</p>
                </div>
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Telefone</p>
                  <p className="text-sm text-foreground">{parceiro.formData.telefone}</p>
                </div>
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1">E-mail</p>
                  <p className="text-sm text-foreground">{parceiro.formData.email}</p>
                </div>
                <div className="pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Site</p>
                  <p className="text-sm text-foreground">{parceiro.formData.site}</p>
                </div>
              </CardContent>
            </Card>

            {/* Right Card - Description */}
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-2">Descrição</p>
                <p className="text-sm text-foreground leading-relaxed">{parceiro.formData.descricao}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Histórico de participação em competições</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-2">Nº de provas concluídas</p>
                <p className="text-3xl font-bold text-foreground">{parceiro.stats.inscricoes}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-2">Nº de tentativas em provas</p>
                <p className="text-3xl font-bold text-foreground">{parceiro.stats.eventos}</p>
              </CardContent>
            </Card>
            <Card className="bg-[#2a2a2a] border-0">
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground mb-2">Total de repasses já recebidos</p>
                <p className="text-3xl font-bold text-foreground">{parceiro.stats.receita}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Repasses Section */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Histórico de repasses</h2>
          <Card className="bg-card border-0 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-table-header">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Data de repasse</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Valor</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Descrição resumida financeiro</th>
                    <th className="px-6 py-3 text-left text-sm font-medium" style={{ color: '#E0E0E0' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {repasses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
                        Nenhum repasse registrado.
                      </td>
                    </tr>
                  ) : (
                    repasses.map((repasse, index) => (
                      <tr
                        key={index}
                        className={`border-t border-border ${index % 2 === 0 ? "bg-table-row" : ""}`}
                      >
                        <td className="px-6 py-4 text-sm text-foreground">{repasse.data}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{repasse.valor}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{repasse.descricao}</td>
                        <td className="px-6 py-4">
                          <Badge variant={repasse.status === "Concluído" ? "success" : "destructive"}>
                            {repasse.status}
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

      {/* Corredor Profile Dialog */}
      <CorredorProfileDialog
        open={isProfileDialogOpen}
        onOpenChange={setIsProfileDialogOpen}
        corredor={{
          name: parceiro.name,
          type: parceiro.type !== "—" ? parceiro.type.toUpperCase() : "PARCEIRO",
          avatar: parceiro.avatar,
          experiencia: "—",
          ranking: "—",
          nivel: parceiro.levelInfo?.name ?? String(parceiro.nivel),
          badges: parceiro.levelInfo ? [{ name: parceiro.levelInfo.name, icon: "🏆" }] : []
        }}
      />

      {/* Inativar Parceiro Dialog */}
      <InativarParceiroDialog
        open={isInativarDialogOpen}
        onOpenChange={setIsInativarDialogOpen}
        parceiroNome={parceiro.name}
        onConfirm={async () => {
          try {
            const now = new Date().toISOString();
            const { error: errProfile } = await supabase
              .from("profiles")
              .update({ is_partner: false, tipo_user: "Corredor", updated_at: now })
              .eq("id", parceiro.id);
            if (errProfile) throw errProfile;

            await supabase
              .from("partnership_requests")
              .update({ status: "inactive" })
              .eq("user_id", parceiro.id);

            toast({
              title: "Parceiro inativado",
              description: `${parceiro.name} foi inativado com sucesso.`,
            });
            setIsInativarDialogOpen(false);
            refetch();
          } catch (e) {
            toast({
              title: "Erro ao inativar",
              description: e instanceof Error ? e.message : "Não foi possível inativar o parceiro.",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
};

export default ParceiroDetalhes;
