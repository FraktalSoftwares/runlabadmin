/**
 * Dados determinísticos da visão geral financeira por período (ano/mês).
 * Mesmo período sempre retorna os mesmos valores (simulação até integração com API).
 */

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const RECEIPT_COLORS = ["#CCF725", "#8B9D00", "#E8F5A0"];
const PARTNER_COLORS = ["#CCF725", "#8B9D00", "#E8F5A0"];

/** Gera número estável para um período (evita valores aleatórios entre renders). */
function seed(year: number, month: number) {
  return year * 12 + month;
}

export interface OverviewMetrics {
  faturamento: number;
  inscricoesPagas: number;
  inscricoesEmAberto: number;
  numeroAssinantes: number;
  margemBruta: number;
  comissaoParceiros: number;
}

export interface PieDataItem {
  name: string;
  value: number;
  color: string;
}

export interface MonthlyBarItem {
  month: string;
  value: number;
  monthIndex: number;
}

export function getOverviewMetrics(year: number, month: number): OverviewMetrics {
  const s = seed(year, month);
  const base = 80000 + (s % 20) * 1500;
  return {
    faturamento: Math.round(base * 1.12),
    inscricoesPagas: 200 + (s % 80),
    inscricoesEmAberto: 60 + (s % 45),
    numeroAssinantes: 90 + (s % 30),
    margemBruta: Math.round(base * 0.18),
    comissaoParceiros: Math.round(base * 0.065),
  };
}

export function getReceiptDataByPeriod(year: number, month: number): PieDataItem[] {
  const s = seed(year, month);
  const a = 35 + (s % 15);
  const b = 55 + (s % 15);
  const c = 100 - a - b;
  return [
    { name: "Inscrição", value: Math.max(10, a), color: RECEIPT_COLORS[0] },
    { name: "Assessoria", value: Math.max(10, b), color: RECEIPT_COLORS[1] },
    { name: "Assinatura", value: Math.max(10, c), color: RECEIPT_COLORS[2] },
  ];
}

export function getPartnerDataByPeriod(year: number, month: number): PieDataItem[] {
  const s = seed(year, month);
  const a = 40 + (s % 20);
  const b = 20 + (s % 15);
  const c = 100 - a - b;
  return [
    { name: "Academia", value: Math.max(10, a), color: PARTNER_COLORS[0] },
    { name: "Treinador", value: Math.max(10, b), color: PARTNER_COLORS[1] },
    { name: "Assessoria", value: Math.max(10, c), color: PARTNER_COLORS[2] },
  ];
}

/** Retorna dados do gráfico de barras (12 meses do ano) e qual índice é o mês selecionado. */
export function getMonthlyInscriptionsData(year: number): MonthlyBarItem[] {
  const y = year;
  return MONTH_LABELS.map((month, monthIndex) => ({
    month,
    value: 5 + ((y * 7 + monthIndex * 11) % 18),
    monthIndex,
  }));
}
