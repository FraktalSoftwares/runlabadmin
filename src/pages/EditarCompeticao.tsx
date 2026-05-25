import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Upload, Pencil, CalendarIcon, CloudUpload, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCompetitionDetails } from "@/hooks/useCompetitionDetails";
import { supabase } from "@/lib/supabase";

function formatPriceCentsToInput(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

function parseValorToCents(valor: string): number {
  const cleaned = (valor || "").replace(/\s/g, "").replace(/R\$\s?/i, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

const DISTANCE_OPTIONS: { value: string; label: string }[] = [
  { value: "3km", label: "3 km" },
  { value: "5km", label: "5 km" },
  { value: "10km", label: "10 km" },
  { value: "15km", label: "15 km" },
  { value: "21km", label: "21 km (meia-maratona)" },
  { value: "42km", label: "42 km (maratona)" },
];

const STANDARD_DISTANCE_METERS: Record<string, number> = {
  "3km": 3000,
  "5km": 5000,
  "10km": 10000,
  "15km": 15000,
  "21km": 21000,
  "42km": 42000,
};

/** Normaliza label de distância para comparação (tolera "5km" vs "5 km"). */
function extractStoragePath(publicUrl: string): string | null {
  const marker = "/storage/v1/object/public/sistema/";
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  return publicUrl.substring(idx + marker.length);
}

const normalizeDistanceLabel = (label: string): string =>
  label.toLowerCase().replace(/\s+/g, "");

const formSchema = z.object({
  nome: z.string().trim().min(1, "Nome da competição é obrigatório").max(100, "Nome muito longo"),
  descricao: z.string().trim().max(500, "Descrição muito longa"),
  modalidade: z.enum(["indoor", "outdoor"], { required_error: "Selecione uma modalidade" }),
  formato: z.enum(["oficial", "patrocinada", "personalizado"], { required_error: "Selecione um formato" }),
  formatoObservacoes: z.string().optional(),
  campeonato: z.string().optional(),
  inscricaoInicio: z.date().optional(),
  inscricaoFim: z.date().optional(),
  competicaoInicio: z.date().optional(),
  competicaoFim: z.date().optional(),
  tentativasIlimitadas: z.boolean().optional(),
  numeroMaximoInscritos: z.boolean().optional(),
  maxInscritos: z.string().optional(),
  premiacoes: z.enum(["sim", "nao"]).optional(),
  quantidadeRecompensas: z.string().optional(),
  outraQuantidade: z.string().optional(),
  possuiKit: z.enum(["sim", "nao"]).optional(),
  tipoCompeticao: z.string().optional(),
  lote1Nome: z.string().optional(),
  lote1Preco: z.string().optional(),
  lote1Descricao: z.string().optional(),
  lote1CreditosAssinatura: z.boolean().optional(),
  lote2Nome: z.string().optional(),
  lote2Preco: z.string().optional(),
  lote2Descricao: z.string().optional(),
  lote2CreditosAssinatura: z.boolean().optional()
});
type FormData = z.infer<typeof formSchema>;

const defaultFormValues: FormData = {
  nome: "",
  descricao: "",
  modalidade: "outdoor",
  formato: "oficial",
  formatoObservacoes: "",
  campeonato: "",
  inscricaoInicio: undefined,
  inscricaoFim: undefined,
  competicaoInicio: undefined,
  competicaoFim: undefined,
  tentativasIlimitadas: false,
  numeroMaximoInscritos: false,
  maxInscritos: "",
  premiacoes: "sim",
  quantidadeRecompensas: "",
  outraQuantidade: "",
  possuiKit: "sim",
  tipoCompeticao: "paga",
  lote1Nome: "",
  lote1Preco: "",
  lote1Descricao: "",
  lote1CreditosAssinatura: false,
  lote2Nome: "",
  lote2Preco: "",
  lote2Descricao: "",
  lote2CreditosAssinatura: false
};

const EditarCompeticao = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: competition, loading: loadingCompetition, error: errorCompetition } = useCompetitionDetails(id);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  /** IDs dos patrocinadores da tabela competition_sponsors selecionados para esta competição */
  const [selectedSponsorIds, setSelectedSponsorIds] = useState<string[]>([]);
  /** Lista de todos os patrocinadores disponíveis (tabela competition_sponsors) */
  const [availableSponsors, setAvailableSponsors] = useState<{ id: string; name: string; logo_url: string | null; sort_order: number }[]>([]);
  const [documento1, setDocumento1] = useState<File | null>(null);
  const [documento2, setDocumento2] = useState<File | null>(null);
  const [documento3, setDocumento3] = useState<File | null>(null);
  const [existingDocs, setExistingDocs] = useState<{ id: string; title: string; fileUrl: string }[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);
  const [selectedDistances, setSelectedDistances] = useState<string[]>([]);
  const [outraDistanciaInput, setOutraDistanciaInput] = useState<string>("");
  const [availableChampionships, setAvailableChampionships] = useState<{ id: string; name: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultFormValues
  });

  // Preencher formulário quando os dados da competição carregarem
  useEffect(() => {
    if (!competition) return;
    const lot0 = competition.lots[0];
    const lot1 = competition.lots[1];

    // Popula seleção de distâncias a partir das linhas em competition_distances.
    // Padrões (3km/5km/...) viram o próprio value; qualquer outra label vira "outro"
    // e preenche outraDistanciaInput com os km (se houver mais de uma não-padrão,
    // a primeira vence — mesmo limite do formulário de cadastro).
    const selectedDistsAcc: string[] = [];
    let outraInputAcc = "";
    for (const d of competition.distances) {
      const norm = normalizeDistanceLabel(d.label ?? "");
      if (STANDARD_DISTANCE_METERS[norm]) {
        selectedDistsAcc.push(norm);
      } else if (!selectedDistsAcc.includes("outro")) {
        selectedDistsAcc.push("outro");
        const km = (d.meters ?? 0) / 1000;
        outraInputAcc = Number.isFinite(km) && km > 0 ? String(km) : (d.label ?? "");
      }
    }
    setSelectedDistances(selectedDistsAcc);
    setOutraDistanciaInput(outraInputAcc);

    const modeValue = (competition.mode === "indoor" || competition.mode === "outdoor") ? competition.mode : "outdoor";
    const formatValue = (competition.formatType === "oficial" || competition.formatType === "patrocinada" || competition.formatType === "personalizado") ? competition.formatType : "oficial";
    form.reset({
      ...defaultFormValues,
      nome: competition.title || "",
      descricao: competition.description ?? "",
      modalidade: modeValue as "indoor" | "outdoor",
      formato: formatValue as "oficial" | "patrocinada" | "personalizado",
      formatoObservacoes: competition.formatObservations ?? "",
      campeonato: competition.championshipId ?? "",
      inscricaoInicio: competition.registrationStartsAt ? new Date(competition.registrationStartsAt) : undefined,
      inscricaoFim: competition.registrationEndsAt ? new Date(competition.registrationEndsAt) : undefined,
      competicaoInicio: competition.startsAt ? new Date(competition.startsAt) : undefined,
      competicaoFim: competition.endsAt ? new Date(competition.endsAt) : undefined,
      tentativasIlimitadas: competition.unlimitedAttempts ?? true,
      numeroMaximoInscritos: competition.maxRegistrations != null,
      maxInscritos: competition.maxRegistrations != null ? String(competition.maxRegistrations) : "",
      premiacoes: competition.prizeDescription ? "sim" : "nao",
      quantidadeRecompensas: "",
      outraQuantidade: "",
      possuiKit: "sim",
      tipoCompeticao: competition.isFree ? "gratuita" : "paga",
      lote1Nome: lot0?.name ?? "",
      lote1Preco: lot0 != null ? formatPriceCentsToInput(lot0.priceCents) : "",
      lote1Descricao: lot0?.description ?? "",
      lote1CreditosAssinatura: lot0?.isSubscriptionAllowed ?? false,
      lote2Nome: lot1?.name ?? "",
      lote2Preco: lot1 != null ? formatPriceCentsToInput(lot1.priceCents) : "",
      lote2Descricao: lot1?.description ?? "",
      lote2CreditosAssinatura: lot1?.isSubscriptionAllowed ?? false
    });
    if (competition.coverImageUrl) setPreviewUrl(competition.coverImageUrl);
    setSelectedSponsorIds(competition.sponsors?.map((s) => s.id) ?? []);
    setExistingDocs(
      (competition.documents ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        fileUrl: d.fileUrl,
      })),
    );
    setRemovedDocIds([]);
  }, [competition, form]);

  // Carregar lista de patrocinadores da tabela competition_sponsors
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("competition_sponsors")
        .select("id, name, logo_url, sort_order")
        .order("sort_order")
        .order("name");
      if (!error && data) setAvailableSponsors(data);
    })();
  }, []);

  // Carregar lista de campeonatos
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("championships")
        .select("id, name")
        .order("name");
      if (!error && data) setAvailableChampionships(data);
    })();
  }, []);

  const toggleSponsor = (sponsorId: string) => {
    setSelectedSponsorIds((prev) =>
      prev.includes(sponsorId) ? prev.filter((id) => id !== sponsorId) : [...prev, sponsorId]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleDocumentoChange = (e: React.ChangeEvent<HTMLInputElement>, setDoc: (file: File | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      setDoc(file);
    }
  };

  const handleDocumentoDrop = (e: React.DragEvent, setDoc: (file: File | null) => void) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setDoc(file);
    }
  };

  const handleSave = async () => {
    if (!id) return;

    const result = formSchema.safeParse(form.getValues());
    if (!result.success) {
      const firstMsg = result.error.errors[0]?.message;
      toast.error(firstMsg || "Preencha todos os campos obrigatórios");
      return;
    }

    const data = result.data;
    setIsSaving(true);
    try {
      const startsAt = data.competicaoInicio?.toISOString() ?? data.inscricaoFim?.toISOString() ?? new Date().toISOString();
      const endsAt = data.competicaoFim?.toISOString() ?? null;
      const regStart = data.inscricaoInicio?.toISOString() ?? null;
      const regEnd = data.inscricaoFim?.toISOString() ?? null;
      const isFree = data.tipoCompeticao === "gratuita";
      const championshipId = data.campeonato && /^[0-9a-f-]{36}$/i.test(data.campeonato) ? data.campeonato : null;
      const maxRegistrations = data.numeroMaximoInscritos && data.maxInscritos?.trim()
        ? parseInt(data.maxInscritos, 10) || null
        : null;

      const { data: updatedRows, error: updateError } = await supabase
        .from("competitions")
        .update({
          title: data.nome.trim(),
          description: data.descricao?.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          registration_starts_at: regStart,
          registration_ends_at: regEnd,
          mode: data.modalidade ?? "outdoor",
          format_type: data.formato ?? "oficial",
          format_observations: data.formato === "personalizado" ? (data.formatoObservacoes?.trim() || null) : null,
          is_free: isFree,
          championship_id: championshipId,
          unlimited_attempts: data.tentativasIlimitadas ?? true,
          max_registrations: maxRegistrations,
          prize_description: data.premiacoes === "sim" ? (data.quantidadeRecompensas || data.outraQuantidade || null) : null,
        })
        .eq("id", id)
        .select();

      if (updateError) throw updateError;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error("Não foi possível atualizar a competição. Verifique suas permissões (RLS).");
      }

      if (selectedImage) {
        const ext = selectedImage.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `competitions/${id}/cover.${ext}`;
        const { error: uploadError } = await supabase.storage.from("sistema").upload(path, selectedImage, { upsert: true });
        if (uploadError) {
          throw new Error(`Falha ao enviar imagem da capa: ${uploadError.message}`);
        }
        const { data: urlData } = supabase.storage.from("sistema").getPublicUrl(path);
        const { error: urlUpdateError } = await supabase
          .from("competitions")
          .update({ cover_image_url: urlData.publicUrl })
          .eq("id", id);
        if (urlUpdateError) throw urlUpdateError;
      }

      const { error: sponsorsUpdateError } = await supabase
        .from("competitions")
        .update({ competition_sponsors: selectedSponsorIds.length > 0 ? selectedSponsorIds : null })
        .eq("id", id);
      if (sponsorsUpdateError) throw sponsorsUpdateError;

      // Sincronizar distâncias: calcular diff entre o que está selecionado
      // no formulário e o que existe no banco, inserindo as novas e removendo
      // as que foram desmarcadas. Mantém intactas as que continuam selecionadas
      // (preservando referências em competition_registrations.distance_id).
      if (competition) {
        type DesiredDistance = { label: string; meters: number; sort_order: number };
        const desiredRows: DesiredDistance[] = [];
        selectedDistances.forEach((d, i) => {
          if (d === "outro") {
            const km = parseFloat(outraDistanciaInput.replace(",", "."));
            if (!Number.isNaN(km) && km > 0) {
              desiredRows.push({
                label: `${km} km`,
                meters: Math.round(km * 1000),
                sort_order: i,
              });
            }
          } else if (STANDARD_DISTANCE_METERS[d]) {
            desiredRows.push({
              label: d,
              meters: STANDARD_DISTANCE_METERS[d],
              sort_order: i,
            });
          }
        });

        if (desiredRows.length === 0) {
          throw new Error("Selecione ao menos uma distância para a competição.");
        }

        const existing = competition.distances;
        const desiredKeys = new Set(desiredRows.map((r) => normalizeDistanceLabel(r.label)));
        const existingKeys = new Set(existing.map((e) => normalizeDistanceLabel(e.label ?? "")));

        // Insert novas
        const toInsert = desiredRows
          .filter((r) => !existingKeys.has(normalizeDistanceLabel(r.label)))
          .map((r) => ({ ...r, competition_id: competition.id }));
        if (toInsert.length > 0) {
          const { error: insertError } = await supabase
            .from("competition_distances")
            .insert(toInsert);
          if (insertError) throw insertError;
        }

        // Delete removidas — se tiver inscrição amarrada, FK bloqueia e a mensagem
        // subjacente informa o admin que precisa cancelar inscrições antes.
        const toDeleteIds = existing
          .filter((e) => !desiredKeys.has(normalizeDistanceLabel(e.label ?? "")))
          .map((e) => e.id);
        if (toDeleteIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("competition_distances")
            .delete()
            .in("id", toDeleteIds);
          if (deleteError) {
            const msg = deleteError.message?.includes("foreign")
              ? "Não foi possível remover uma das distâncias porque já existem inscritos nela."
              : deleteError.message;
            throw new Error(msg);
          }
        }
      }

      // Sincronizar lotes com base no tipo da competição.
      // Gratuita: remove todos os lotes existentes para o app não exibir preços.
      // Paga: faz upsert dos slots 0/1 do form (update se já existem, insert caso contrário).
      if (competition) {
        if (isFree) {
          const { error: deleteError } = await supabase
            .from("competition_lots")
            .delete()
            .eq("competition_id", id);
          if (deleteError) throw deleteError;
        } else {
          const lots = competition.lots;
          const formLots = [
            {
              nome: data.lote1Nome?.trim() ?? "",
              preco: data.lote1Preco ?? "",
              descricao: data.lote1Descricao?.trim() ?? "",
              creditos: data.lote1CreditosAssinatura ?? false,
            },
            {
              nome: data.lote2Nome?.trim() ?? "",
              preco: data.lote2Preco ?? "",
              descricao: data.lote2Descricao?.trim() ?? "",
              creditos: data.lote2CreditosAssinatura ?? false,
            },
          ];

          for (let i = 0; i < formLots.length; i++) {
            const formLot = formLots[i];
            const existing = lots[i];
            const hasContent = formLot.nome || formLot.preco || formLot.descricao;
            if (!hasContent && !existing) continue;

            const payload = {
              name: formLot.nome || existing?.name || `Lote ${i + 1}`,
              description: formLot.descricao || null,
              price_cents: parseValorToCents(formLot.preco),
              is_subscription_allowed: formLot.creditos,
            };

            if (existing) {
              const { error: updateLotError } = await supabase
                .from("competition_lots")
                .update(payload)
                .eq("id", existing.id);
              if (updateLotError) throw updateLotError;
            } else {
              const { error: insertLotError } = await supabase
                .from("competition_lots")
                .insert({
                  ...payload,
                  competition_id: id,
                  currency: "BRL",
                  is_active: true,
                  sort_order: i,
                });
              if (insertLotError) throw insertLotError;
            }
          }
        }
      }

      // Sincronizar documentos: deletar marcados pra remoção + upload dos novos.
      if (id) {
        if (removedDocIds.length > 0) {
          const docsToDelete = (competition?.documents ?? []).filter((d) =>
            removedDocIds.includes(d.id),
          );
          const storagePaths = docsToDelete
            .map((d) => extractStoragePath(d.fileUrl))
            .filter((p): p is string => p !== null);
          if (storagePaths.length > 0) {
            await supabase.storage.from("sistema").remove(storagePaths);
          }
          const { error: deleteDocsError } = await supabase
            .from("competition_documents")
            .delete()
            .in("id", removedDocIds);
          if (deleteDocsError) throw deleteDocsError;
        }

        const newDocs = [documento1, documento2, documento3].filter(
          (f): f is File => f != null,
        );
        if (newDocs.length > 0) {
          const baseSortOrder = existingDocs.filter(
            (d) => !removedDocIds.includes(d.id),
          ).length;
          for (let i = 0; i < newDocs.length; i++) {
            const file = newDocs[i];
            const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
            const path = `competitions/${id}/documents/${Date.now()}-${i}.${ext}`;
            const { error: uploadDocError } = await supabase.storage
              .from("sistema")
              .upload(path, file, {
                upsert: true,
                contentType: file.type || "application/octet-stream",
              });
            if (uploadDocError) throw uploadDocError;
            const { data: urlData } = supabase.storage
              .from("sistema")
              .getPublicUrl(path);
            const { error: insertDocError } = await supabase
              .from("competition_documents")
              .insert({
                competition_id: id,
                title: file.name,
                file_url: urlData.publicUrl,
                sort_order: baseSortOrder + i,
              });
            if (insertDocError) throw insertDocError;
          }
        }
      }

      toast.success("Dados salvos com sucesso!");
      navigate(`/gestao-competicoes/${id}`);
    } catch (e) {
      console.error("Erro ao salvar competição:", e);
      toast.error(e instanceof Error ? e.message : "Erro ao salvar competição");
    } finally {
      setIsSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 container mx-auto px-6 py-8">
          <p className="text-destructive">ID da competição não informado.</p>
          <Button variant="link" onClick={() => navigate("/gestao-competicoes")}>Voltar</Button>
        </div>
      </div>
    );
  }

  if (loadingCompetition) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 container mx-auto px-6 py-8 flex items-center justify-center">
          <p className="text-muted-foreground">Carregando competição...</p>
        </div>
      </div>
    );
  }

  if (errorCompetition || !competition) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-24 container mx-auto px-6 py-8">
          <p className="text-destructive">{errorCompetition?.message ?? "Competição não encontrada."}</p>
          <Button variant="link" onClick={() => navigate("/gestao-competicoes")}>Voltar à lista</Button>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-24">
      {/* Action Bar */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" className="gap-2 hover:bg-transparent" style={{ color: '#CCF725' }} onClick={() => navigate(`/gestao-competicoes/${id}`)}>
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>

            <Button type="button" disabled={isSaving} onClick={handleSave} className="gap-2 border-0 hover:brightness-90 transition-all" style={{
            backgroundColor: '#CCF725',
            color: '#1A1A1A'
          }}>
              {isSaving ? "Salvando..." : "Salvar dados"}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Banner */}
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center gap-3 rounded-[20px] px-6 py-4" style={{
        backgroundColor: '#CCF725',
        color: '#1A1A1A'
      }}>
          <div className="w-6 h-6 rounded-full bg-[#1A1A1A] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5 1.75L12.25 3.5L4.375 11.375H2.625V9.625L10.5 1.75Z" stroke="#CCF725" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm font-medium">Você está editando está página</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div>
          {/* Image Upload Area */}
          <div className="relative rounded-[20px] bg-[#1A1A1A] p-12 flex flex-col items-center justify-center gap-4 min-h-[400px]" onDragOver={handleDragOver} onDrop={handleDrop}>
            {previewUrl ? <div className="relative w-full h-full flex items-center justify-center">
                <img src={previewUrl} alt="Preview" className="max-w-full max-h-[350px] rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl("");
                  }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center hover:brightness-90 transition-all"
                  style={{ backgroundColor: '#CCF725' }}
                >
                  <X className="w-5 h-5" style={{ color: '#1A1A1A' }} />
                </button>
              </div> : <>
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{
              backgroundColor: '#CCF725'
            }}>
                  <Upload className="w-8 h-8" style={{
                color: '#1A1A1A'
              }} />
                </div>
                
                <p className="text-sm" style={{ color: '#CCF725' }}>
                  Arraste e solte a imagem aqui
                </p>

                <input type="file" id="file-upload" className="hidden" accept="image/*" onChange={handleImageChange} />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="cursor-pointer border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725] hover:text-[#1A1A1A] bg-transparent" asChild>
                    <span>Procurar arquivo</span>
                  </Button>
                </label>
              </>}
          </div>

          {/* Dados Básicos Form */}
          <div className="mt-10">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-6">Dados básicos</h2>

              {/* Nome da competição */}
              <div className="mb-6">
                <Label htmlFor="nome" className="text-sm text-muted-foreground mb-2 block">
                  Nome da competição
                </Label>
                <Input id="nome" placeholder="Ex: Desafio 5km" {...form.register("nome")} className="bg-[#1A1A1A] border-border/30" />
                {form.formState.errors.nome && <p className="text-sm text-destructive mt-1">{form.formState.errors.nome.message}</p>}
              </div>

              {/* Descrição */}
              <div className="mb-6">
                <Label htmlFor="descricao" className="text-sm text-muted-foreground mb-2 block">
                  Descrição
                </Label>
                <div className="relative">
                  <Textarea id="descricao" placeholder="Insira a descrição aqui..." {...form.register("descricao")} className="bg-[#1A1A1A] border-border/30 min-h-[120px] resize-none" />
                  <button type="button" className="absolute bottom-3 right-3 p-1.5 rounded-md hover:bg-accent">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {form.formState.errors.descricao && <p className="text-sm text-destructive mt-1">{form.formState.errors.descricao.message}</p>}
              </div>

              {/* Modalidade e Formato */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <Label htmlFor="modalidade" className="text-sm text-muted-foreground mb-2 block">
                    Modalidade
                  </Label>
                  <Select value={form.watch("modalidade")} onValueChange={value => form.setValue("modalidade", value as "indoor" | "outdoor", { shouldDirty: true, shouldValidate: true })}>
                    <SelectTrigger className="bg-[#1A1A1A] border-border/30">
                      <SelectValue placeholder="Selecione a modalidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A1A] border-border/30">
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.modalidade && <p className="text-sm text-destructive mt-1">{form.formState.errors.modalidade.message}</p>}
                </div>

                <div>
                  <Label htmlFor="formato" className="text-sm text-muted-foreground mb-2 block">
                    Formato
                  </Label>
                  <Select value={form.watch("formato")} onValueChange={value => form.setValue("formato", value as "oficial" | "patrocinada" | "personalizado", { shouldDirty: true, shouldValidate: true })}>
                    <SelectTrigger className="bg-[#1A1A1A] border-border/30">
                      <SelectValue placeholder="Selecione o formato" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1A1A1A] border-border/30">
                      <SelectItem value="oficial">Oficial</SelectItem>
                      <SelectItem value="patrocinada">Patrocinada</SelectItem>
                      <SelectItem value="personalizado">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.formato && <p className="text-sm text-destructive mt-1">{form.formState.errors.formato.message}</p>}
                </div>
              </div>

              {/* Observações do formato (apenas para Personalizado) */}
              {form.watch("formato") === "personalizado" && (
                <div className="mb-6">
                  <Label htmlFor="formatoObservacoes" className="text-sm text-muted-foreground mb-2 block">
                    Observações do formato
                  </Label>
                  <Textarea
                    id="formatoObservacoes"
                    {...form.register("formatoObservacoes")}
                    placeholder="Descreva os detalhes do formato personalizado..."
                    className="bg-[#1A1A1A] border-border/30 min-h-[100px] resize-none"
                  />
                </div>
              )}

              {/* Vincular campeonato */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="campeonato" className="text-sm text-muted-foreground">
                    Vincular campeonato
                  </Label>
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                </div>
                <Select value={form.watch("campeonato") || ""} onValueChange={value => form.setValue("campeonato", value, { shouldDirty: true, shouldValidate: true })}>
                  <SelectTrigger className="bg-[#1A1A1A] border-border/30">
                    <SelectValue placeholder="Selecione o campeonato a ser vinculado" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A1A] border-border/30">
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    {availableChampionships.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Distâncias permitidas */}
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Distância(s) permitida(s)
                </Label>
                <div className="flex flex-wrap gap-3">
                  {DISTANCE_OPTIONS.map((distance) => {
                    const isSelected = selectedDistances.includes(distance.value);
                    return (
                      <Button
                        key={distance.value}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() =>
                          setSelectedDistances((prev) =>
                            prev.includes(distance.value)
                              ? prev.filter((d) => d !== distance.value)
                              : [...prev, distance.value]
                          )
                        }
                        className="rounded-full"
                      >
                        {distance.label}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    variant={selectedDistances.includes("outro") ? "default" : "outline"}
                    onClick={() =>
                      setSelectedDistances((prev) =>
                        prev.includes("outro")
                          ? prev.filter((d) => d !== "outro")
                          : [...prev, "outro"]
                      )
                    }
                    className="rounded-full"
                  >
                    Outro
                  </Button>
                </div>
                {selectedDistances.includes("outro") && (
                  <Input
                    placeholder="Ex.: 7 (para 7 km)"
                    className="mt-3 bg-[#1A1A1A] border-border/30"
                    value={outraDistanciaInput}
                    onChange={(e) => setOutraDistanciaInput(e.target.value)}
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione uma ou mais distâncias. Distâncias com inscritos só podem ser removidas após cancelar as inscrições correspondentes.
                </p>
              </div>
            </div>
          </div>

          {/* Período Section */}
          <div className="mt-6">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-6">Período</h2>

              {/* Período de inscrições */}
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-3 block">
                  Período de inscrições
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Data Início Inscrição */}
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-[#1A1A1A] border-border/30", !form.watch("inscricaoInicio") && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.watch("inscricaoInicio") ? format(form.watch("inscricaoInicio")!, "dd/MM/yyyy") : <span>De: DD/MM/AAAA</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#1A1A1A] border-border/30" align="start">
                        <Calendar mode="single" selected={form.watch("inscricaoInicio")} onSelect={date => form.setValue("inscricaoInicio", date, { shouldDirty: true, shouldValidate: true })} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Data Fim Inscrição */}
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-[#1A1A1A] border-border/30", !form.watch("inscricaoFim") && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.watch("inscricaoFim") ? format(form.watch("inscricaoFim")!, "dd/MM/yyyy") : <span>Até: DD/MM/AAAA</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#1A1A1A] border-border/30" align="start">
                        <Calendar mode="single" selected={form.watch("inscricaoFim")} onSelect={date => form.setValue("inscricaoFim", date, { shouldDirty: true, shouldValidate: true })} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Período da competição */}
              <div>
                <Label className="text-sm text-muted-foreground mb-3 block">
                  Período da competição
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Data Início Competição */}
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-[#1A1A1A] border-border/30", !form.watch("competicaoInicio") && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.watch("competicaoInicio") ? format(form.watch("competicaoInicio")!, "dd/MM/yyyy") : <span>De: DD/MM/AAAA</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#1A1A1A] border-border/30" align="start">
                        <Calendar mode="single" selected={form.watch("competicaoInicio")} onSelect={date => form.setValue("competicaoInicio", date, { shouldDirty: true, shouldValidate: true })} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Data Fim Competição */}
                  <div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal bg-[#1A1A1A] border-border/30", !form.watch("competicaoFim") && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.watch("competicaoFim") ? format(form.watch("competicaoFim")!, "dd/MM/yyyy") : <span>Até: DD/MM/AAAA</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#1A1A1A] border-border/30" align="start">
                        <Calendar mode="single" selected={form.watch("competicaoFim")} onSelect={date => form.setValue("competicaoFim", date, { shouldDirty: true, shouldValidate: true })} initialFocus className={cn("p-3 pointer-events-auto")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Regras Section */}
          <div className="mt-6">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-6">Regras</h2>

              {/* Tentativas ilimitadas */}
              <div className="flex items-center gap-3 mb-4">
                <Checkbox
                  id="tentativasIlimitadas"
                  checked={form.watch("tentativasIlimitadas") || false}
                  onCheckedChange={(checked) =>
                    form.setValue("tentativasIlimitadas", checked as boolean, { shouldDirty: true })
                  }
                />
                <Label
                  htmlFor="tentativasIlimitadas"
                  className="text-sm text-foreground cursor-pointer"
                >
                  Tentativas ilimitadas
                </Label>
              </div>

              {/* Número máximo de inscritos */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="numeroMaximoInscritos"
                    checked={form.watch("numeroMaximoInscritos") || false}
                    onCheckedChange={(checked) =>
                      form.setValue("numeroMaximoInscritos", checked as boolean, { shouldDirty: true })
                    }
                  />
                  <Label
                    htmlFor="numeroMaximoInscritos"
                    className="text-sm text-foreground cursor-pointer"
                  >
                    Número máximo de inscritos
                  </Label>
                </div>

                {form.watch("numeroMaximoInscritos") && (
                  <div className="ml-7 space-y-2">
                    <Input
                      type="number"
                      placeholder="Ex: 100"
                      {...form.register("maxInscritos")}
                      className="bg-[#1A1A1A] border-border/30 w-48"
                    />
                    {competition?.stats && (() => {
                      const inscritos = competition.stats.totalAthletes;
                      const maxValue = Number.parseInt(form.watch("maxInscritos") || "0", 10) || 0;
                      const lotado = maxValue > 0 && inscritos >= maxValue;
                      return (
                        <p className={`text-sm ${lotado ? "text-red-400" : "text-muted-foreground"}`}>
                          Inscritos atuais: {inscritos}
                          {maxValue > 0 ? ` / ${maxValue}` : ""}
                          {lotado ? " — Lotada" : ""}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Premiações Section */}
          <div className="mt-6">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-6">Premiações</h2>

              {/* Sim/Não Radio */}
              <RadioGroup
                value={form.watch("premiacoes")}
                onValueChange={(value) => form.setValue("premiacoes", value as "sim" | "nao", { shouldDirty: true })}
                className="flex gap-6 mb-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="premiacoes-sim" />
                  <Label htmlFor="premiacoes-sim" className="text-sm cursor-pointer">
                    Sim
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="premiacoes-nao" />
                  <Label htmlFor="premiacoes-nao" className="text-sm cursor-pointer">
                    Não
                  </Label>
                </div>
              </RadioGroup>

              {form.watch("premiacoes") === "sim" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Nº de pessoas que poderão ganhar recompensas
                  </p>

                  {/* Quantidade Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "px-6 py-2 bg-[#1A1A1A] border-border/30",
                        form.watch("quantidadeRecompensas") === "5-5" &&
                          "border-0"
                      )}
                      style={
                        form.watch("quantidadeRecompensas") === "5-5"
                          ? { backgroundColor: "#CCF725", color: "#1A1A1A" }
                          : {}
                      }
                      onClick={() => form.setValue("quantidadeRecompensas", "5-5", { shouldDirty: true })}
                    >
                      5-5
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "px-6 py-2 bg-[#1A1A1A] border-border/30",
                        form.watch("quantidadeRecompensas") === "6-10" &&
                          "border-0"
                      )}
                      style={
                        form.watch("quantidadeRecompensas") === "6-10"
                          ? { backgroundColor: "#CCF725", color: "#1A1A1A" }
                          : {}
                      }
                      onClick={() => form.setValue("quantidadeRecompensas", "6-10", { shouldDirty: true })}
                    >
                      6-10
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "px-6 py-2 bg-[#1A1A1A] border-border/30",
                        form.watch("quantidadeRecompensas") === "11-20" &&
                          "border-0"
                      )}
                      style={
                        form.watch("quantidadeRecompensas") === "11-20"
                          ? { backgroundColor: "#CCF725", color: "#1A1A1A" }
                          : {}
                      }
                      onClick={() => form.setValue("quantidadeRecompensas", "11-20", { shouldDirty: true })}
                    >
                      11-20
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "px-6 py-2 bg-[#1A1A1A] border-border/30",
                        form.watch("quantidadeRecompensas") === "outro" &&
                          "border-0"
                      )}
                      style={
                        form.watch("quantidadeRecompensas") === "outro"
                          ? { backgroundColor: "#CCF725", color: "#1A1A1A" }
                          : {}
                      }
                      onClick={() => form.setValue("quantidadeRecompensas", "outro", { shouldDirty: true })}
                    >
                      Outro
                    </Button>
                  </div>

                  {/* Input condicional para "Outro" */}
                  {form.watch("quantidadeRecompensas") === "outro" && (
                    <Input
                      type="text"
                      placeholder="Insira outra quantidade"
                      {...form.register("outraQuantidade")}
                      className="bg-[#1A1A1A] border-border/30"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Inscrição e checkout Section */}
          <div className="mt-6">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-6">Inscrição e checkout</h2>

              {/* Possui kit incluído? */}
              <div className="mb-6">
                <Label className="text-sm text-muted-foreground mb-3 block">
                  Possui kit incluído?
                </Label>
                <RadioGroup
                  value={form.watch("possuiKit")}
                  onValueChange={(value) => form.setValue("possuiKit", value as "sim" | "nao", { shouldDirty: true })}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="sim" id="kit-sim" />
                    <Label htmlFor="kit-sim" className="text-sm cursor-pointer">
                      Sim
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="nao" id="kit-nao" />
                    <Label htmlFor="kit-nao" className="text-sm cursor-pointer">
                      Não
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Tipo de competição */}
              <div className="mb-6">
                <Label htmlFor="tipoCompeticao" className="text-sm text-muted-foreground mb-2 block">
                  Tipo de competição
                </Label>
                <Select
                  value={form.watch("tipoCompeticao")}
                  onValueChange={(value) => form.setValue("tipoCompeticao", value, { shouldDirty: true })}
                >
                  <SelectTrigger className="bg-[#1A1A1A] border-border/30">
                    <SelectValue placeholder="Selecione: Gratuita ou Paga" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A1A] border-border/30">
                    <SelectItem value="gratuita">Gratuita</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.watch("tipoCompeticao") === "paga" && (
                <>
                  {/* Lote 1 */}
                  <div className="mb-6">
                    <Label className="text-sm text-muted-foreground mb-3 block">
                      Ex.: Lote 1 - Medalha garantida
                    </Label>

                    <Input
                      placeholder="R$ 0,00"
                      {...form.register("lote1Preco")}
                      className="bg-[#1A1A1A] border-border/30 mb-3"
                    />

                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Descrição
                    </Label>
                    <Textarea
                      placeholder="Ex.: Medalha garantida a todos os inscritos"
                      {...form.register("lote1Descricao")}
                      className="bg-[#1A1A1A] border-border/30 min-h-[100px] resize-none mb-3"
                    />

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="lote1Creditos"
                        checked={form.watch("lote1CreditosAssinatura") || false}
                        onCheckedChange={(checked) =>
                          form.setValue("lote1CreditosAssinatura", checked as boolean, { shouldDirty: true })
                        }
                      />
                      <Label
                        htmlFor="lote1Creditos"
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Permitir compra com créditos de assinatura
                      </Label>
                    </div>
                  </div>

                  {/* Lote 2 */}
                  <div>
                    <Label className="text-sm text-muted-foreground mb-3 block">
                      Ex.: Lote 2 - Camiseta garantida + Medalha
                    </Label>

                    <Input
                      placeholder="R$ 0,00"
                      {...form.register("lote2Preco")}
                      className="bg-[#1A1A1A] border-border/30 mb-3"
                    />

                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Descrição
                    </Label>
                    <Textarea
                      placeholder="Ex.: Camiseta garantida a todos os inscritos"
                      {...form.register("lote2Descricao")}
                      className="bg-[#1A1A1A] border-border/30 min-h-[100px] resize-none mb-3"
                    />

                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="lote2Creditos"
                        checked={form.watch("lote2CreditosAssinatura") || false}
                        onCheckedChange={(checked) =>
                          form.setValue("lote2CreditosAssinatura", checked as boolean, { shouldDirty: true })
                        }
                      />
                      <Label
                        htmlFor="lote2Creditos"
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Permitir compra com créditos de assinatura
                      </Label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Patrocinadores Section - seleção da tabela competition_sponsors */}
          <div className="mt-6">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-2">Patrocinadores</h2>
              <p className="text-sm text-muted-foreground mb-6">Selecione os patrocinadores que aparecerão nesta competição.</p>
              <div className="flex flex-wrap gap-4">
                {availableSponsors.map((sponsor) => {
                  const isSelected = selectedSponsorIds.includes(sponsor.id);
                  return (
                    <button
                      key={sponsor.id}
                      type="button"
                      onClick={() => toggleSponsor(sponsor.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 p-4 min-w-[120px] transition-all",
                        isSelected
                          ? "border-[#CCF725] bg-[#CCF725]/10"
                          : "border-border/50 bg-[#1A1A1A] hover:border-muted-foreground/50"
                      )}
                    >
                      <div className="w-16 h-16 rounded-lg bg-[#2A2A2A] flex items-center justify-center overflow-hidden">
                        {sponsor.logo_url ? (
                          <img src={sponsor.logo_url} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <span className="text-xs text-muted-foreground truncate px-1 text-center">{sponsor.name.slice(0, 8)}</span>
                        )}
                      </div>
                      <span className="text-sm text-foreground font-medium text-center line-clamp-2">{sponsor.name}</span>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: isSelected ? '#CCF725' : undefined, backgroundColor: isSelected ? '#CCF725' : undefined }}>
                        {isSelected && <Check className="w-3 h-3" style={{ color: '#1A1A1A' }} />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {availableSponsors.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum patrocinador cadastrado na base. Cadastre em competition_sponsors para exibir aqui.</p>
              )}
            </div>
          </div>

          {/* Documentos Section */}
          <div className="mt-6">
            <div className="rounded-[20px] border border-border/50 bg-[#2A2A2A] p-8">
              <h2 className="text-lg font-semibold mb-6">Documentos</h2>

              {existingDocs.filter((d) => !removedDocIds.includes(d.id)).length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Documentos já enviados:</p>
                  {existingDocs
                    .filter((d) => !removedDocIds.includes(d.id))
                    .map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-[#1A1A1A] px-3 py-2"
                      >
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs truncate"
                          style={{ color: "#CCF725" }}
                        >
                          {d.title}
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setRemovedDocIds((prev) => [...prev, d.id])
                          }
                          className="w-5 h-5 rounded-full flex items-center justify-center hover:brightness-90"
                          style={{ backgroundColor: "#CCF725" }}
                          title="Remover"
                        >
                          <X className="w-3 h-3" style={{ color: "#1A1A1A" }} />
                        </button>
                      </div>
                    ))}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                {/* Documento 1 */}
                <div
                  className="relative rounded-[20px] bg-[#1A1A1A] p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDocumentoDrop(e, setDocumento1)}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center" 
                    style={{ backgroundColor: '#CCF725' }}
                  >
                    <CloudUpload 
                      className="w-6 h-6" 
                      style={{ color: '#1A1A1A' }} 
                    />
                  </div>
                  
                  <p className="text-xs text-center" style={{ color: '#CCF725' }}>
                    Arraste e solte o arquivo aqui
                  </p>

                  <input 
                    type="file" 
                    id="documento1-upload" 
                    className="hidden" 
                    onChange={(e) => handleDocumentoChange(e, setDocumento1)}
                  />
                  <label htmlFor="documento1-upload">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="cursor-pointer border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725] hover:text-[#1A1A1A] bg-transparent text-xs" 
                      asChild
                    >
                      <span>Procurar arquivo</span>
                    </Button>
                  </label>
                  
                  {documento1 && (
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-[#CCF725]">{documento1.name}</p>
                      <button
                        type="button"
                        onClick={() => setDocumento1(null)}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:brightness-90 transition-all"
                        style={{ backgroundColor: '#CCF725' }}
                      >
                        <X className="w-3 h-3" style={{ color: '#1A1A1A' }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Documento 2 */}
                <div
                  className="relative rounded-[20px] bg-[#1A1A1A] p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDocumentoDrop(e, setDocumento2)}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center" 
                    style={{ backgroundColor: '#CCF725' }}
                  >
                    <CloudUpload 
                      className="w-6 h-6" 
                      style={{ color: '#1A1A1A' }} 
                    />
                  </div>
                  
                  <p className="text-xs text-center" style={{ color: '#CCF725' }}>
                    Arraste e solte o arquivo aqui
                  </p>

                  <input 
                    type="file" 
                    id="documento2-upload" 
                    className="hidden" 
                    onChange={(e) => handleDocumentoChange(e, setDocumento2)}
                  />
                  <label htmlFor="documento2-upload">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="cursor-pointer border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725] hover:text-[#1A1A1A] bg-transparent text-xs" 
                      asChild
                    >
                      <span>Procurar arquivo</span>
                    </Button>
                  </label>
                  
                  {documento2 && (
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-[#CCF725]">{documento2.name}</p>
                      <button
                        type="button"
                        onClick={() => setDocumento2(null)}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:brightness-90 transition-all"
                        style={{ backgroundColor: '#CCF725' }}
                      >
                        <X className="w-3 h-3" style={{ color: '#1A1A1A' }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Documento 3 */}
                <div
                  className="relative rounded-[20px] bg-[#1A1A1A] p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDocumentoDrop(e, setDocumento3)}
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center" 
                    style={{ backgroundColor: '#CCF725' }}
                  >
                    <CloudUpload 
                      className="w-6 h-6" 
                      style={{ color: '#1A1A1A' }} 
                    />
                  </div>
                  
                  <p className="text-xs text-center" style={{ color: '#CCF725' }}>
                    Arraste e solte o arquivo aqui
                  </p>

                  <input 
                    type="file" 
                    id="documento3-upload" 
                    className="hidden" 
                    onChange={(e) => handleDocumentoChange(e, setDocumento3)}
                  />
                  <label htmlFor="documento3-upload">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="cursor-pointer border-[#CCF725] text-[#CCF725] hover:bg-[#CCF725] hover:text-[#1A1A1A] bg-transparent text-xs" 
                      asChild
                    >
                      <span>Procurar arquivo</span>
                    </Button>
                  </label>
                  
                  {documento3 && (
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-[#CCF725]">{documento3.name}</p>
                      <button
                        type="button"
                        onClick={() => setDocumento3(null)}
                        className="w-5 h-5 rounded-full flex items-center justify-center hover:brightness-90 transition-all"
                        style={{ backgroundColor: '#CCF725' }}
                      >
                        <X className="w-3 h-3" style={{ color: '#1A1A1A' }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-5 flex justify-end">
            <Button 
              type="button" 
              disabled={isSaving}
              onClick={handleSave}
              className="gap-2 border-0 hover:brightness-90 transition-all px-8 py-3" 
              style={{
                backgroundColor: '#CCF725',
                color: '#1A1A1A'
              }}
            >
              <Check className="w-5 h-5" />
              {isSaving ? "Salvando..." : "Salvar dados"}
            </Button>
          </div>
        </div>
      </main>
    </div>
    </div>;
};
export default EditarCompeticao;