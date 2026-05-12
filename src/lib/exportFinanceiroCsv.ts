import type { FinanceiroCompetitionRow } from "@/hooks/useFinanceiroCompeticoes";
import type { RecebimentoRow } from "@/hooks/useRecebimentos";
import type { PartnerRow } from "@/hooks/usePartners";
import type { RepasseRow } from "@/hooks/useRepasses";
import { formatCurrency } from "@/lib/formatCurrency";

function escapeCsv(value: string): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Competições ──────────────────────────────────────────

const COMP_HEADERS = [
  "ID",
  "Nome",
  "Etapa vinculada",
  "Nº inscrições",
  "Margem bruta",
  "Receita total",
  "Comissão parceiros",
  "Status",
];

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  finalizada: "Finalizada",
  rascunho: "Rascunho",
};

export function downloadCompeticoesCsv(rows: FinanceiroCompetitionRow[]) {
  const lines = rows.map((r) =>
    [
      escapeCsv(r.numericId),
      escapeCsv(r.nome),
      escapeCsv(r.etapaVinculada),
      escapeCsv(String(r.inscricoes)),
      escapeCsv(formatCurrency(r.margemBruta)),
      escapeCsv(formatCurrency(r.receitaTotal)),
      escapeCsv(formatCurrency(r.comissaoParceiros)),
      escapeCsv(STATUS_LABELS[r.status] ?? r.status),
    ].join(","),
  );
  const csv = COMP_HEADERS.join(",") + "\n" + lines.join("\n");
  downloadCsv(csv, `financeiro_competicoes_${new Date().toISOString().slice(0, 10)}.csv`);
}

// ── Recebimentos ─────────────────────────────────────────

const REC_HEADERS = [
  "ID",
  "Nome",
  "Recebimento",
  "Competição",
  "Valor",
  "Data",
  "Pagamento",
  "Status",
];

const REC_STATUS_LABELS: Record<string, string> = {
  pago: "Pago",
  em_aberto: "Em aberto",
  vencido: "Vencido",
  reembolsado: "Reembolsado",
  cancelado: "Cancelado",
};

export function downloadRecebimentosCsv(rows: RecebimentoRow[]) {
  const lines = rows.map((r) =>
    [
      escapeCsv(r.shortId),
      escapeCsv(r.nome),
      escapeCsv(r.tipoRecebimento),
      escapeCsv(r.competicao),
      escapeCsv(formatCurrency(r.valor)),
      escapeCsv(r.data),
      escapeCsv(r.pagamento),
      escapeCsv(REC_STATUS_LABELS[r.status] ?? r.status),
    ].join(","),
  );
  const csv = REC_HEADERS.join(",") + "\n" + lines.join("\n");
  downloadCsv(csv, `financeiro_recebimentos_${new Date().toISOString().slice(0, 10)}.csv`);
}

// ── Parceiros ─────────────────────────────────────────────

const PARTNER_HEADERS = [
  "Nome",
  "E-mail",
  "Telefone",
  "CPF/CNPJ",
  "Tipo de parceiro",
  "Último acesso",
  "Status",
];

export function downloadParceirosCsv(rows: PartnerRow[]) {
  const lines = rows.map((r) =>
    [
      escapeCsv(r.name),
      escapeCsv(r.email),
      escapeCsv(r.phone),
      escapeCsv(r.cpfCnpj),
      escapeCsv(r.type),
      escapeCsv(r.lastAccess),
      escapeCsv(r.status),
    ].join(","),
  );
  const csv = PARTNER_HEADERS.join(",") + "\n" + lines.join("\n");
  downloadCsv(csv, `parceiros_${new Date().toISOString().slice(0, 10)}.csv`);
}

// ── Repasses ──────────────────────────────────────────────

const REPASSES_HEADERS = [
  "Nome",
  "Tipo de parceiro",
  "Comissão acumulada",
  "Total já repassado",
  "Último repasse",
  "Status",
];

const REPASSES_STATUS_LABELS: Record<string, string> = {
  pago: "Pago",
  em_processamento: "Em processamento",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  erro: "Erro",
  pendente: "Pendente",
  sem_solicitacao: "Sem saque pedido",
};

export function downloadRepassesCsv(rows: RepasseRow[]) {
  const lines = rows.map((r) =>
    [
      escapeCsv(r.nome),
      escapeCsv(r.tipoParceiro),
      escapeCsv(r.commissionAccruedFormatted),
      escapeCsv(r.paidTotalFormatted),
      escapeCsv(r.ultimoRepasse),
      escapeCsv(REPASSES_STATUS_LABELS[r.status] ?? r.status),
    ].join(","),
  );
  const csv = REPASSES_HEADERS.join(",") + "\n" + lines.join("\n");
  downloadCsv(csv, `financeiro_repasses_${new Date().toISOString().slice(0, 10)}.csv`);
}
