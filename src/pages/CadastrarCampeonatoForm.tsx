import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, Check, CalendarIcon, AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

/* ─── Schema ─── */
const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  short_name: z.string().optional(),
  period_start: z.date().optional(),
  period_end: z.date().optional(),
  stages_count: z.string().optional(),
  medalists_count: z.string().optional(),
  ranking_type: z.string().optional(),
  has_awards: z.enum(["sim", "nao"]).default("sim"),
  award_winners_range: z.string().optional(),
  award_custom_count: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

/* ─── Options ─── */
const RANKING_OPTIONS = [
  { value: "ranking_soma", label: "Ranking soma" },
  { value: "ranking_media", label: "Ranking média" },
  { value: "ranking_etapa", label: "Ranking por etapa" },
  { value: "ranking_geral", label: "Ranking geral" },
] as const;

const STAGES_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

const MEDALISTS_OPTIONS = [
  { value: "1", label: "1" },
  { value: "3", label: "3" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "15", label: "15" },
  { value: "20", label: "20" },
];

const AWARD_TYPES_OPTIONS = ["Badge", "Sorteio", "Outro"] as const;

/* ─── Competition row for linking ─── */
type CompetitionOption = { id: string; title: string };

const parseDateOnly = (value: string | null): Date | undefined =>
  value ? new Date(`${value}T00:00:00`) : undefined;

export default function CadastrarCampeonatoForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* competitions for linking */
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [initialCompetitionIds, setInitialCompetitionIds] = useState<string[]>([]);
  const [outroCompetition, setOutroCompetition] = useState("");

  /* award types (chip selection) */
  const [selectedAwardTypes, setSelectedAwardTypes] = useState<string[]>([]);
  const [outroAwardType, setOutroAwardType] = useState("");

  /* championship has existing awards (for disabled state) */
  const [championshipHasAwards, setChampionshipHasAwards] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      short_name: "",
      period_start: undefined,
      period_end: undefined,
      stages_count: "",
      medalists_count: "",
      ranking_type: "",
      has_awards: "sim",
      award_winners_range: "",
      award_custom_count: "",
    },
  });

  /* Fetch available competitions */
  const fetchCompetitions = useCallback(async () => {
    try {
      let query = supabase
        .from("competitions")
        .select("id, title, championship_id");

      query = id
        ? query.or(`championship_id.is.null,championship_id.eq.${id}`)
        : query.is("championship_id", null);

      const { data } = await query.order("created_at", { ascending: false });
      setCompetitions(
        (data ?? []).map((c) => ({ id: c.id, title: c.title ?? "Sem nome" }))
      );
    } catch {
      /* ignore */
    }
  }, [id]);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  useEffect(() => {
    if (!id) return;

    const fetchChampionship = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [{ data: championship, error: championshipError }, { data: linked, error: linkedError }] = await Promise.all([
          supabase.from("championships").select("*").eq("id", id).single(),
          supabase.from("competitions").select("id").eq("championship_id", id),
        ]);

        if (championshipError) throw championshipError;
        if (linkedError) throw linkedError;

        form.reset({
          name: championship.name ?? "",
          short_name: championship.short_name ?? "",
          period_start: parseDateOnly(championship.period_start),
          period_end: parseDateOnly(championship.period_end),
          stages_count: championship.stages_count != null ? String(championship.stages_count) : "",
          medalists_count: championship.medalists_count != null ? String(championship.medalists_count) : "",
          ranking_type: championship.ranking_type ?? "",
          has_awards: championship.has_awards ? "sim" : "nao",
          award_winners_range: championship.award_winners_range ?? "",
          award_custom_count: championship.award_custom_count ?? "",
        });

        const linkedIds = (linked ?? []).map((competition) => competition.id);
        setSelectedCompetitions(linkedIds);
        setInitialCompetitionIds(linkedIds);
        setSelectedAwardTypes(
          (championship.award_types ?? []).filter((type: string) =>
            AWARD_TYPES_OPTIONS.includes(type as (typeof AWARD_TYPES_OPTIONS)[number])
          )
        );
        setOutroAwardType(championship.award_custom_type ?? "");
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Erro ao carregar campeonato");
      } finally {
        setIsLoading(false);
      }
    };

    fetchChampionship();
  }, [form, id]);

  /* Toggle competition chip */
  const toggleCompetition = (id: string) => {
    setSelectedCompetitions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  /* Toggle award type chip */
  const toggleAwardType = (type: string) => {
    setSelectedAwardTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  /* ─── Save ─── */
  const saveChampionship = async (status: "draft" | "published") => {
    const data = form.getValues();
    if (!data.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setIsSubmitting(true);
    try {
      const awardTypes = [...selectedAwardTypes];
      if (selectedAwardTypes.includes("Outro") && outroAwardType.trim()) {
        awardTypes.push(outroAwardType.trim());
      }

      const stagesCount = data.stages_count
        ? Math.max(0, parseInt(data.stages_count, 10) || 0)
        : 0;
      const medalistsCount = data.medalists_count
        ? Math.max(0, parseInt(data.medalists_count, 10) || 0)
        : 0;

      const payload = {
        name: data.name.trim(),
        short_name: data.short_name?.trim() || null,
        stages_count: stagesCount,
        medalists_count: medalistsCount,
        period_start: data.period_start
          ? format(data.period_start, "yyyy-MM-dd")
          : null,
        period_end: data.period_end
          ? format(data.period_end, "yyyy-MM-dd")
          : null,
        ranking_type: data.ranking_type || null,
        status,
        has_awards: data.has_awards === "sim",
        award_winners_range: data.award_winners_range || null,
        award_custom_count:
          data.award_winners_range === "outro"
            ? data.award_custom_count || null
            : null,
        award_types: awardTypes.length > 0 ? awardTypes : null,
        award_custom_type:
          selectedAwardTypes.includes("Outro") && outroAwardType.trim()
            ? outroAwardType.trim()
            : null,
      };

      let championshipId = id;
      if (id) {
        const { error: championshipError } = await supabase
          .from("championships")
          .update(payload)
          .eq("id", id);
        if (championshipError) throw championshipError;
      } else {
        const { data: championship, error: championshipError } = await supabase
          .from("championships")
          .insert(payload)
          .select("id")
          .single();
        if (championshipError) throw championshipError;
        championshipId = championship.id;
      }

      /* Link selected competitions (apenas IDs válidos de competições, exclui "outro") */
      const validCompetitionIds = selectedCompetitions.filter(
        (id) => id !== "outro" && competitions.some((c) => c.id === id)
      );
      const removedCompetitionIds = initialCompetitionIds.filter(
        (competitionId) => !validCompetitionIds.includes(competitionId)
      );
      if (removedCompetitionIds.length > 0) {
        const { error: unlinkError } = await supabase
          .from("competitions")
          .update({ championship_id: null })
          .in("id", removedCompetitionIds);
        if (unlinkError) throw unlinkError;
      }

      if (validCompetitionIds.length > 0 && championshipId) {
        const { error: linkError } = await supabase
          .from("competitions")
          .update({ championship_id: championshipId })
          .in("id", validCompetitionIds);
        if (linkError) throw linkError;
      }

      toast.success(
        status === "draft"
          ? "Rascunho salvo com sucesso!"
          : isEditing
            ? "Campeonato atualizado com sucesso!"
            : "Campeonato publicado com sucesso!"
      );
      navigate("/gestao-competicoes");
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : typeof (e as { message?: string })?.message === "string"
            ? (e as { message: string }).message
            : "Erro desconhecido ao salvar.";
      toast.error("Erro ao salvar campeonato", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSalvarRascunho = () => saveChampionship("draft");
  const handlePublicar = () => saveChampionship("published");

  /* ─── Watched values ─── */
  const hasAwards = form.watch("has_awards");
  const awardWinnersRange = form.watch("award_winners_range");

  /* ─── Premiações disabled? ─── */
  const premiacoesDisabled = championshipHasAwards;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-[1044px] px-6 py-8 pt-24">
          <p className="text-muted-foreground">Carregando campeonato...</p>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-[1044px] px-6 py-8 pt-24">
          <p className="text-destructive mb-4">{loadError}</p>
          <Button type="button" onClick={() => navigate("/gestao-competicoes")}>Voltar</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-[1044px] px-6 py-8 pt-24">
        {/* ═══ Action Bar ═══ */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/gestao-competicoes")}
            className="bg-[#171717] text-[#CCF725] hover:brightness-90 border-0 rounded-[999px] min-w-[112px] h-[48px] px-5 gap-2"
          >
            <ChevronLeft className="h-5 w-5" />
            Voltar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleSalvarRascunho}
            disabled={isSubmitting}
            className="bg-[#171717] text-[#CCF725] hover:brightness-90 border-0 rounded-[999px] min-w-[112px] h-[48px] px-5 gap-2"
          >
            <Check className="h-5 w-5" />
            Salvar rascunho
          </Button>
        </div>

        {/* ═══ Breadcrumb ═══ */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-8">
          <button
            type="button"
            className="text-[#808080] hover:underline"
            onClick={() => navigate("/gestao-competicoes")}
          >
            Campeonato
          </button>
          <span className="text-[#808080]">&gt;</span>
          <span className="text-[#4d4d4d]">{isEditing ? "Editar campeonato" : "Novo campeonato"}</span>
        </div>

        {/* ═══ SECTION: Dados básicos ═══ */}
        <div className="bg-[#262626] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-medium text-[#f5f5f5] mb-6">
            Dados básicos
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Nome do campeonato */}
            <div>
              <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
                Nome do campeonato
              </Label>
              <Input
                {...form.register("name")}
                placeholder="Ex: Campeonato de Florianópolis 2025"
                className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-base text-[#b2b2b2] placeholder:text-[#b2b2b2]"
              />
              {form.formState.errors.name && (
                <p className="text-destructive text-sm mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Nome reduzido */}
            <div>
              <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
                Nome reduzido
              </Label>
              <Input
                {...form.register("short_name")}
                placeholder="Ex: Floripa 2025"
                className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-base text-[#b2b2b2] placeholder:text-[#b2b2b2]"
              />
            </div>
          </div>
        </div>

        {/* ═══ SECTION: Período ═══ */}
        <div className="bg-[#262626] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-medium text-[#f5f5f5] mb-6">Período</h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Início */}
            <div>
              <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
                Período do campeonato (início e fim)
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 hover:bg-[#1A1A1A]/80",
                      !form.watch("period_start") && "text-[#b2b2b2]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("period_start")
                      ? format(form.watch("period_start")!, "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "De: DD/MM/AAAA"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("period_start") ?? undefined}
                    onSelect={(d) =>
                      form.setValue("period_start", d ?? undefined)
                    }
                    locale={ptBR}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Fim */}
            <div>
              <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
                &nbsp;
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 hover:bg-[#1A1A1A]/80",
                      !form.watch("period_end") && "text-[#b2b2b2]"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("period_end")
                      ? format(form.watch("period_end")!, "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "Até: DD/MM/AAAA"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("period_end") ?? undefined}
                    onSelect={(d) =>
                      form.setValue("period_end", d ?? undefined)
                    }
                    locale={ptBR}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* ═══ SECTION: Etapas e medalhistas ═══ */}
        <div className="bg-[#262626] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-medium text-[#f5f5f5] mb-6">
            Etapas e medalhistas
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantidade de etapas */}
            <div>
              <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
                Quantidade de etapas
              </Label>
              <Select
                value={form.watch("stages_count") ?? ""}
                onValueChange={(v) => form.setValue("stages_count", v)}
              >
                <SelectTrigger className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-[#b2b2b2]">
                  <SelectValue placeholder="Selecione a quantidade de etapas" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-border/30">
                  {STAGES_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantidade de medalhistas */}
            <div>
              <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
                Quantidade de medalhistas
              </Label>
              <Select
                value={form.watch("medalists_count") ?? ""}
                onValueChange={(v) => form.setValue("medalists_count", v)}
              >
                <SelectTrigger className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-[#b2b2b2]">
                  <SelectValue placeholder="Selecione a quantidade de medalhistas por etapa" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-border/30">
                  {MEDALISTS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ═══ SECTION: Ranking ═══ */}
        <div className="bg-[#262626] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-medium text-[#f5f5f5] mb-6">Ranking</h2>

          <div>
            <Label className="text-base font-medium text-[#f5f5f5] mb-2 block">
              Tipo de ranking
            </Label>
            <Select
              value={form.watch("ranking_type") ?? ""}
              onValueChange={(v) =>
                form.setValue(
                  "ranking_type",
                  v as FormData["ranking_type"]
                )
              }
            >
              <SelectTrigger className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-[#b2b2b2]">
                <SelectValue placeholder="Selecione o tipo de ranking" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-border/30">
                {RANKING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ═══ SECTION: Competições ═══ */}
        <div className="bg-[#262626] rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-medium text-[#f5f5f5] mb-6">
            Competições
          </h2>

          <div>
            <p className="text-sm font-semibold text-[#e0e0e0] mb-2">
              Vincular competições
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {competitions.map((comp) => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => toggleCompetition(comp.id)}
                  className={cn(
                    "px-4 py-3 rounded-lg text-xs font-medium transition-all min-w-[104px] text-center",
                    selectedCompetitions.includes(comp.id)
                      ? "bg-[#D9FF40] text-[#1A1A1A]"
                      : "bg-[#1A1A1A] text-[#b2b2b2] hover:bg-[#333]"
                  )}
                >
                  {comp.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSelectedCompetitions((prev) =>
                    prev.includes("outro")
                      ? prev.filter((c) => c !== "outro")
                      : [...prev, "outro"]
                  )
                }
                className={cn(
                  "px-4 py-3 rounded-lg text-xs font-medium transition-all min-w-[104px] text-center",
                  selectedCompetitions.includes("outro")
                    ? "bg-[#D9FF40] text-[#1A1A1A]"
                    : "bg-[#1A1A1A] text-[#b2b2b2] hover:bg-[#333]"
                )}
              >
                Outro
              </button>
              <div className="flex-1 min-w-[224px]">
                <Input
                  placeholder="Insira outro tipo"
                  value={outroCompetition}
                  onChange={(e) => setOutroCompetition(e.target.value)}
                  className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-base text-[#b2b2b2] placeholder:text-[#b2b2b2]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION: Premiações ═══ */}
        <div className="bg-[#262626] rounded-2xl p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-xl font-medium text-[#f5f5f5] mb-2">
              Premiações
            </h2>

            {/* Warning banner (only shows when championship already has awards) */}
            {premiacoesDisabled && (
              <div className="flex items-center gap-2 py-3 px-3">
                <AlertTriangle className="h-5 w-5 text-[#404040] shrink-0" />
                <p className="text-base text-[#404040]">
                  Este campeonato já possui uma configuração de medalha
                  vinculada. As informações de premiação foram importadas
                  automaticamente.
                </p>
              </div>
            )}
          </div>

          <div
            className={cn(
              "flex flex-col gap-6",
              premiacoesDisabled && "opacity-50 pointer-events-none"
            )}
          >
            {/* Sim / Não Radio */}
            <div className="flex flex-col gap-4">
              <RadioGroup
                value={form.watch("has_awards")}
                onValueChange={(v) =>
                  form.setValue("has_awards", v as "sim" | "nao")
                }
                className="flex items-center gap-0"
                disabled={premiacoesDisabled}
              >
                <div className="flex items-center w-[177px]">
                  <RadioGroupItem
                    value="sim"
                    id="awards-sim"
                    className="mr-2"
                  />
                  <Label
                    htmlFor="awards-sim"
                    className="text-sm text-[#e0e0e0] cursor-pointer"
                  >
                    Sim
                  </Label>
                </div>
                <div className="flex items-center w-[177px]">
                  <RadioGroupItem
                    value="nao"
                    id="awards-nao"
                    className="mr-2"
                  />
                  <Label
                    htmlFor="awards-nao"
                    className="text-sm text-[#e0e0e0] cursor-pointer"
                  >
                    Não
                  </Label>
                </div>
              </RadioGroup>

              {/* N de pessoas que poderão ganhar recompensa */}
              {hasAwards === "sim" && (
                <div>
                  <p className="text-sm font-semibold text-[#e0e0e0] mb-2">
                    N de pessoas que poderão ganhar recompensa
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {["1-5", "6-10", "11-20", "outro"].map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={() =>
                          form.setValue("award_winners_range", range)
                        }
                        disabled={premiacoesDisabled}
                        className={cn(
                          "px-4 py-3 rounded-lg text-xs font-medium transition-all min-w-[104px] text-center",
                          awardWinnersRange === range
                            ? "bg-[#D9FF40] text-[#1A1A1A]"
                            : "bg-[#1A1A1A] text-[#b2b2b2] hover:bg-[#333]"
                        )}
                      >
                        {range === "outro"
                          ? "Outro"
                          : range === "1-5"
                          ? "1–5"
                          : range === "6-10"
                          ? "6–10"
                          : "11–20"}
                      </button>
                    ))}
                    <div className="flex-1 min-w-[224px]">
                      <Input
                        placeholder="Insira outra quantidade"
                        {...form.register("award_custom_count")}
                        disabled={premiacoesDisabled}
                        className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-base text-[#b2b2b2] placeholder:text-[#b2b2b2]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tipos de premiações */}
            {hasAwards === "sim" && (
              <div>
                <p className="text-sm font-semibold text-[#e0e0e0] mb-2">
                  Tipos de premiações
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {AWARD_TYPES_OPTIONS.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleAwardType(type)}
                      disabled={premiacoesDisabled}
                      className={cn(
                        "px-4 py-3 rounded-lg text-xs font-medium transition-all min-w-[104px] text-center",
                        selectedAwardTypes.includes(type)
                          ? "bg-[#D9FF40] text-[#1A1A1A]"
                          : "bg-[#1A1A1A] text-[#b2b2b2] hover:bg-[#333]"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                  <div className="flex-1 min-w-[224px]">
                    <Input
                      placeholder="Insira outro tipo"
                      value={outroAwardType}
                      onChange={(e) => setOutroAwardType(e.target.value)}
                      disabled={premiacoesDisabled}
                      className="bg-[#1A1A1A] border-0 rounded-full h-[44px] px-4 text-base text-[#b2b2b2] placeholder:text-[#b2b2b2]"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Footer: Salvar e publicar ═══ */}
        <div className="flex items-center justify-end h-[48px] mb-16">
          <Button
            type="button"
            onClick={handlePublicar}
            disabled={isSubmitting}
            className="border-0 hover:brightness-90 transition-all min-w-[112px] h-[48px] px-5 gap-2 rounded-full"
            style={{ backgroundColor: '#CCF725', color: '#1A1A1A' }}
          >
            <Check className="h-5 w-5" />
            {isSubmitting ? "Salvando..." : "Salvar e publicar"}
          </Button>
        </div>
      </main>
    </div>
  );
}
