import { useState } from "react";
import { Header } from "@/components/Header";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { ChevronLeft, ChevronRight, Pencil, Download, Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/Pagination";
import { ExportDialog } from "@/components/ExportDialog";
import { InscricoesFilterDialog } from "@/components/InscricoesFilterDialog";
import { CompeticaoDetalheTabProvider, CompeticaoDetalheTabs, useCompeticaoDetalheTab } from "@/components/CompeticaoDetalheTabs";
import {
  useCompetitionDetails,
  useCompetitionRegistrations,
  useCompetitionRanking,
  formatPace,
  formatTime,
  formatDistanceKm,
  formatPrice,
  formatDateBR,
  formatDateRangeBR,
  mapRegistrationStatus,
  mapCompetitionStatus,
  mapRunState,
  mapHiddenReason,
  exportRegistrationsCsv,
  exportRankingCsv,
} from "@/hooks/useCompetitionDetails";
import type { CompetitionDetail, InscricoesFilters } from "@/hooks/useCompetitionDetails";
import { toast } from "sonner";
import competitionHero from "@/assets/competition-hero.png";

// ─── Status Badge ────────────────────────────────────────

const getRegistrationStatusBadge = (status: string) => {
  const mapped = mapRegistrationStatus(status);
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-0 hover:bg-yellow-500/20 px-4 py-1 rounded-full">
          {mapped}
        </Badge>
      );
    case "confirmed":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-0 hover:bg-green-500/20 px-4 py-1 rounded-full">
          {mapped}
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-0 hover:bg-red-500/20 px-4 py-1 rounded-full">
          {mapped}
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-500/20 text-gray-400 border-0 hover:bg-gray-500/20 px-4 py-1 rounded-full">
          {mapped}
        </Badge>
      );
  }
};

// ─── Loading Component ───────────────────────────────────

const LoadingState = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
    <span className="ml-3 text-muted-foreground">Carregando...</span>
  </div>
);

// ─── Error Component ─────────────────────────────────────

const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <p className="text-red-400 mb-4">{message}</p>
    {onRetry && (
      <Button
        onClick={onRetry}
        className="border-0 hover:brightness-90 transition-all"
        style={{ backgroundColor: "#CCF725", color: "#1A1A1A" }}
      >
        Tentar novamente
      </Button>
    )}
  </div>
);

// ─── Empty State ─────────────────────────────────────────

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center py-16">
    <p className="text-muted-foreground">{message}</p>
  </div>
);

// ─── Tab: Detalhes ───────────────────────────────────────

const DetalhesTab = ({ competition }: { competition: CompetitionDetail }) => {
  const distanceRange =
    competition.distances.length > 0
      ? competition.distances.length === 1
        ? competition.distances[0].label
        : `De ${formatDistanceKm(
            Math.min(...competition.distances.map((d) => d.meters))
          )} a ${formatDistanceKm(
            Math.max(...competition.distances.map((d) => d.meters))
          )}`
      : "-";

  return (
    <>
      {/* Hero Image */}
      <div className="mb-8 rounded-lg overflow-hidden">
        <img
          src={competition.coverImageUrl || competitionHero}
          alt={competition.title}
          className="w-full h-[380px] object-cover"
        />
      </div>

      {/* Estatísticas */}
      <div className="mb-8 bg-[#262626] rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Estatísticas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[#1A1A1A] border-0">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground mb-2">Total de inscritos</p>
              <p className="text-2xl font-semibold text-foreground">
                {competition.stats.totalAthletes} atleta{competition.stats.totalAthletes !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-0">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground mb-2">Total de inscrições</p>
              <p className="text-2xl font-semibold text-foreground">
                {competition.stats.totalRegistrations} inscrição{competition.stats.totalRegistrations !== 1 ? "ões" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-0">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground mb-2">Total em vendas</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatPrice(competition.stats.totalRevenueCents)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dados da competição */}
      <div className="mb-8 bg-[#262626] rounded-lg p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Dados da competição</h2>
        <Card className="bg-[#1A1A1A] border-0 mb-4">
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-1">
                {competition.title.toUpperCase()}
              </h3>
              {competition.locationName && (
                <p className="text-sm text-foreground">{competition.locationName.toUpperCase()}</p>
              )}
            </div>

            {competition.description && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Descrição</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {competition.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-[#1A1A1A] border-0">
            <CardContent className="p-6 space-y-6 divide-y divide-border">
              <div className="pt-0">
                <p className="text-xs text-muted-foreground mb-2">Período de inscrições</p>
                <p className="text-base font-medium text-foreground">
                  {formatDateRangeBR(
                    competition.registrationStartsOn,
                    competition.registrationEndsOn
                  )}
                </p>
              </div>

              <div className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Período da competição</p>
                <p className="text-base font-medium text-foreground">
                  {formatDateRangeBR(competition.startsOn, competition.endsOn)}
                </p>
              </div>

              <div className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Modalidade</p>
                <p className="text-base font-medium text-foreground">
                  {competition.mode === "outdoor" ? "Outdoor" : competition.mode === "mista" ? "Mista" : "Indoor"}
                </p>
              </div>

              <div className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Formato</p>
                <p className="text-base font-medium text-foreground">
                  {competition.formatType === "patrocinada" ? "Patrocinada" : competition.formatType === "personalizado" ? "Personalizado" : "Oficial"}
                </p>
                {competition.formatType === "personalizado" && competition.formatObservations && (
                  <p className="text-sm text-muted-foreground mt-1">{competition.formatObservations}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-0">
            <CardContent className="p-6 space-y-6 divide-y divide-border">
              <div className="pt-0">
                <p className="text-xs text-muted-foreground mb-2">Distância</p>
                <p className="text-base font-medium text-foreground">{distanceRange}</p>
              </div>

              <div className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Premiação</p>
                <p className="text-base font-medium text-foreground">
                  {competition.prizeDescription || "-"}
                </p>
              </div>

              <div className="pt-6">
                <p className="text-xs text-muted-foreground mb-2">Status</p>
                <p className="text-base font-medium text-foreground">
                  {mapCompetitionStatus(competition.status)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Valores / Lotes */}
      {competition.lots.length > 0 && (
        <div className="mb-8 bg-[#262626] rounded-lg p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {competition.lots.map((lot) => (
              <Card key={lot.id} className="bg-[#1A1A1A] border-0">
                <CardContent className="p-6">
                  <p className="text-xs text-muted-foreground mb-2">{lot.name}</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {formatPrice(lot.priceCents)}
                  </p>
                  {lot.description && (
                    <p className="text-sm text-muted-foreground mt-2">{lot.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Patrocinadores */}
      {competition.sponsors.length > 0 && (
        <div className="mb-8 bg-[#262626] rounded-lg p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Patrocinadores</h2>
          <Card className="bg-[#1A1A1A] border-0">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {competition.sponsors.map((sponsor) => (
                  <div key={sponsor.id} className="flex flex-col items-center gap-2">
                    {sponsor.logoUrl ? (
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="max-h-16 object-contain"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">Logo</span>
                      </div>
                    )}
                    <p className="text-sm text-foreground text-center">{sponsor.name}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Documentos */}
      {competition.documents.length > 0 && (
        <div className="mb-8 bg-[#262626] rounded-lg p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">Documentos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {competition.documents.map((doc) => (
              <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                <Card className="bg-[#1A1A1A] border-0 hover:bg-[#222222] transition-colors cursor-pointer">
                  <CardContent className="p-6 flex items-center justify-between">
                    <p className="text-sm" style={{ color: "#CCF725" }}>
                      {doc.title}
                    </p>
                    <Download className="w-5 h-5" style={{ color: "#CCF725" }} />
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

// ─── Tab: Inscrições ─────────────────────────────────────

const InscricoesTab = ({
  competitionId,
  filters,
  page,
  onPageChange,
}: {
  competitionId: string;
  filters: InscricoesFilters;
  page: number;
  onPageChange: (page: number) => void;
}) => {
  const pageSize = 10;
  const { data, total, loading, error, refetch } = useCompetitionRegistrations(
    competitionId,
    page,
    pageSize,
    filters
  );

  const hasActiveFilters = Object.keys(filters).length > 0;

  if (loading && data.length === 0) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (data.length === 0) {
    return (
      <EmptyState
        message={
          hasActiveFilters
            ? "Nenhuma inscrição encontrada com os filtros aplicados."
            : "Nenhuma inscrição encontrada."
        }
      />
    );
  }

  return (
    <>
      <div className="rounded-lg overflow-hidden border border-border mb-6">
        <div className="px-6 py-4 bg-[#262626] flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Inscritos</h2>
          <p className="text-sm text-muted-foreground">
            {total} inscrito{total !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtrado)"}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-table-header hover:bg-table-header">
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Nome
              </TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Distância
              </TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Tentativas
              </TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Lote
              </TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Valor
              </TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Tamanho
              </TableHead>
              <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((reg) => (
              <TableRow
                key={reg.id}
                className="border-border hover:bg-muted/50 bg-[#262626]"
              >
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                      {reg.userAvatar ? (
                        <img
                          src={reg.userAvatar}
                          alt={reg.userName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                          {reg.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {reg.userName}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {reg.distanceLabel || "-"}
                </TableCell>
                <TableCell className="text-foreground text-center">
                  {reg.attempts}
                </TableCell>
                <TableCell className="text-foreground">{reg.lotName || "-"}</TableCell>
                <TableCell className="text-foreground">
                  {formatPrice(reg.priceCents)}
                </TableCell>
                <TableCell className="text-foreground">
                  {reg.shirtSize ?? "-"}
                </TableCell>
                <TableCell>{getRegistrationStatusBadge(reg.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </>
  );
};

// ─── Tab: Ranking ────────────────────────────────────────

const RankingTab = ({ competitionId }: { competitionId: string }) => {
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<"public" | "audit">("public");
  const pageSize = 10;
  const { data, total, loading, error, refetch } = useCompetitionRanking(
    competitionId,
    page,
    pageSize,
    source
  );

  if (loading && data.length === 0) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant={source === "public" ? "default" : "secondary"}
          onClick={() => {
            setSource("public");
            setPage(1);
          }}
        >
          Ranking público (app)
        </Button>
        <Button
          type="button"
          variant={source === "audit" ? "default" : "secondary"}
          onClick={() => {
            setSource("audit");
            setPage(1);
          }}
        >
          Auditoria de tentativas
        </Button>
      </div>

      <div className="rounded-lg overflow-hidden border border-border mb-6">
        <div className="px-6 py-4 bg-[#262626] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {source === "public" ? "Ranking público (app)" : "Auditoria de tentativas"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {source === "public"
                ? "Mesma fonte exibida no app, com paces abaixo de 3:00/km ocultos."
                : "Inclui todos que tentaram correr e mostra por que podem não aparecer no app."}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{total} resultado{total !== 1 ? "s" : ""}</p>
        </div>
        {data.length === 0 ? (
          <EmptyState message="Nenhum resultado no ranking ainda." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-table-header hover:bg-table-header">
                <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Posição</TableHead>
                <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Corredor</TableHead>
                <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Pace</TableHead>
                <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Tempo</TableHead>
                <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Distância</TableHead>
                {source === "audit" && (
                  <>
                    <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>Status</TableHead>
                    <TableHead className="font-medium" style={{ color: "#E0E0E0" }}>App</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow
                  key={`${source}-${item.userId}-${item.distanceMeters}-${item.position}`}
                  className="border-border hover:bg-muted/50 bg-[#262626]"
                >
                  <TableCell className="text-foreground font-medium">{item.position}º</TableCell>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                        {item.userAvatar ? (
                          <img src={item.userAvatar} alt={item.userName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                            {item.userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      {item.userName}
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">{formatPace(item.paceSecondsPerKm)}</TableCell>
                  <TableCell className="text-foreground">{formatTime(item.totalTimeSeconds)}</TableCell>
                  <TableCell className="text-foreground">{formatDistanceKm(item.distanceMeters)}</TableCell>
                  {source === "audit" && (
                    <>
                      <TableCell className="text-foreground">{mapRunState(item.state)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.publicVisibility === "visible"
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                          }
                        >
                          {mapHiddenReason(item.hiddenReason)}
                        </Badge>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Pagination
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </>
  );
};

// ─── Main Content ────────────────────────────────────────

const CompeticaoDetalhesContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { activeTab } = useCompeticaoDetalheTab();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [inscricoesFilters, setInscricoesFilters] = useState<InscricoesFilters>({});
  const [inscricoesPage, setInscricoesPage] = useState(1);

  const { data: competition, loading, error, refetch } = useCompetitionDetails(id);

  const handleExport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      if (activeTab === "inscricoes") {
        await exportRegistrationsCsv(id);
        toast.success("Inscrições exportadas com sucesso!");
      } else if (activeTab === "ranking") {
        await exportRankingCsv(id);
        toast.success("Ranking exportado com sucesso!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar dados");
    } finally {
      setExporting(false);
      setIsExportDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-6 py-8 pt-24">
        <LoadingState />
      </main>
    );
  }

  if (error || !competition) {
    return (
      <main className="container mx-auto px-6 py-8 pt-24">
        <div className="mt-16 mb-8">
          <Link to="/gestao-competicoes">
            <Button
              className="gap-2 border-0 hover:brightness-90 transition-all"
              style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
            >
              <ChevronLeft className="w-5 h-5" />
              Voltar
            </Button>
          </Link>
        </div>
        <ErrorState
          message={error?.message || "Competição não encontrada"}
          onRetry={refetch}
        />
      </main>
    );
  }

  return (
    <main className="container mx-auto px-6 py-8 pt-24">
      {/* Back Button and Action Buttons */}
      <div className="mt-16 mb-8 flex items-center justify-between">
        <Link to="/gestao-competicoes">
          <Button
            className="gap-2 border-0 hover:brightness-90 transition-all"
            style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
          >
            <ChevronLeft className="w-5 h-5" />
            Voltar
          </Button>
        </Link>

        <div className="flex gap-3">
          {activeTab === "inscricoes" ? (
            <>
              <Button
                className="gap-2 border-0 hover:brightness-90 transition-all"
                style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
                onClick={() => setIsFilterDialogOpen(true)}
              >
                <Filter className="w-4 h-4" />
                Filtrar
              </Button>
              <Button
                className="gap-2 border-0 hover:brightness-90 transition-all"
                style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
                onClick={() => setIsExportDialogOpen(true)}
              >
                <Download className="w-4 h-4" />
                Exportar
              </Button>
            </>
          ) : activeTab === "ranking" ? (
            <Button
              className="gap-2 border-0 hover:brightness-90 transition-all"
              style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
              onClick={() => setIsExportDialogOpen(true)}
            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          ) : hasPermission("competicoes.edit") ? (
            <Button
              className="gap-2 border-0 hover:brightness-90 transition-all"
              style={{ backgroundColor: "#1A1A1A", color: "#CCF725" }}
              onClick={() => navigate(`/gestao-competicoes/${id}/editar`)}
            >
              <Pencil className="w-4 h-4" />
              Editar dados
            </Button>
          ) : null}
        </div>
      </div>

      {/* Breadcrumb - Only visible on Detalhes tab */}
      {activeTab === "detalhes" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8 py-2.5">
          <Link to="/gestao-competicoes" className="hover:text-foreground">
            Competições
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{competition.title}</span>
        </div>
      )}

      {/* Tabs */}
      <CompeticaoDetalheTabs />

      {/* Tab Content */}
      {activeTab === "detalhes" && <DetalhesTab competition={competition} />}
      {activeTab === "inscricoes" && (
        <InscricoesTab
          competitionId={competition.id}
          filters={inscricoesFilters}
          page={inscricoesPage}
          onPageChange={setInscricoesPage}
        />
      )}
      {activeTab === "ranking" && <RankingTab competitionId={competition.id} />}

      {/* Dialogs */}
      <ExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleExport}
        exporting={exporting}
      />
      <InscricoesFilterDialog
        open={isFilterDialogOpen}
        onOpenChange={setIsFilterDialogOpen}
        initialFilters={inscricoesFilters}
        onApply={(f) => {
          setInscricoesFilters(f);
          setInscricoesPage(1);
        }}
      />
    </main>
  );
};

// ─── Root Component ──────────────────────────────────────

const CompeticaoDetalhes = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <CompeticaoDetalheTabProvider>
        <CompeticaoDetalhesContent />
      </CompeticaoDetalheTabProvider>
    </div>
  );
};

export default CompeticaoDetalhes;
