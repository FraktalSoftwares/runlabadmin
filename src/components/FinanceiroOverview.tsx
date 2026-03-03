import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LegendProps,
} from "recharts";
import { formatCurrency } from "@/lib/formatCurrency";
import { useFinanceiroOverview } from "@/hooks/useFinanceiroOverview";
import { PendingWithdrawalsBanner } from "@/components/PendingWithdrawalsBanner";
import { SolicitacoesSaqueDialog } from "@/components/SolicitacoesSaqueDialog";

const MetricCard = ({
  title,
  value,
  highlightValue = false,
  highlightTitle = false,
}: {
  title: string;
  value: string | number;
  highlightValue?: boolean;
  highlightTitle?: boolean;
}) => (
  <Card className="p-6 bg-card">
    <div className="space-y-[30px]">
      <p
        className={`text-sm ${highlightTitle ? "text-primary" : "text-muted-foreground"}`}
      >
        {title}
      </p>
      <p
        className={`text-3xl font-bold ${highlightValue ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  </Card>
);

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const emptyMonthlyData = MONTH_LABELS.map((month, monthIndex) => ({
  month,
  value: 0,
  monthIndex,
}));

const now = new Date();
const currentYearDefault = now.getFullYear();
const currentMonthDefault = now.getMonth();

function CustomLegend({ payload }: LegendProps) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {payload.map((entry, index) => {
        const name = String(entry.value ?? "");
        const percent = typeof entry.payload?.value === "number" ? entry.payload.value : 0;
        return (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="h-5 w-5 rounded-[5px] shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">
              {name} ({percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

export const FinanceiroOverview = () => {
  const [currentYear, setCurrentYear] = useState(currentYearDefault);
  const [currentMonth, setCurrentMonth] = useState(currentMonthDefault);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [solicitacoesOpen, setSolicitacoesOpen] = useState(false);

  const { data, isLoading, isError, error } = useFinanceiroOverview(
    currentYear,
    currentMonth,
  );

  const metrics = data?.metrics ?? {
    faturamento: 0,
    inscricoesPagas: 0,
    inscricoesEmAberto: 0,
    numeroAssinantes: 0,
    margemBruta: 0,
    comissaoParceiros: 0,
  };
  const receiptData = data?.receiptData ?? [];
  const partnerData = data?.partnerData ?? [];
  const monthlyData = data?.monthlyData ?? emptyMonthlyData;

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectMonth = (monthIndex: number) => {
    setCurrentMonth(monthIndex);
    setIsPopoverOpen(false);
  };

  const handlePrevYear = () => setCurrentYear((y) => y - 1);
  const handleNextYear = () => setCurrentYear((y) => y + 1);

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentYear((y) => y - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-medium text-foreground min-w-[4rem] text-center">
              {currentYear}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentYear((y) => y + 1)}
              aria-label="Próximo ano"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <Card className="p-8 bg-destructive/10 border-destructive/30">
          <p className="text-destructive font-medium">Erro ao carregar dados financeiros</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Tente alterar o período ou recarregar a página."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-lg">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
      {/* Seletor de período (ano + mês) */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePrevYear}
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-medium text-foreground min-w-[4rem] text-center">
            {currentYear}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleNextYear}
            aria-label="Próximo ano"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handlePrevMonth}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="px-8 min-w-[140px]"
                aria-expanded={isPopoverOpen}
                aria-haspopup="listbox"
                aria-label={`Mês selecionado: ${MONTHS[currentMonth]}`}
              >
                <span className="text-lg font-medium text-primary">
                  {MONTHS[currentMonth]}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-4 bg-card border-border"
              align="center"
              role="listbox"
              aria-label="Selecionar mês"
            >
              <div className="grid grid-cols-3 gap-2">
                {MONTHS.map((month, index) => (
                  <button
                    key={index}
                    type="button"
                    role="option"
                    aria-selected={index === currentMonth}
                    onClick={() => handleSelectMonth(index)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      index === currentMonth
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={handleNextMonth}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Banner de solicitações pendentes */}
      <PendingWithdrawalsBanner onClick={() => setSolicitacoesOpen(true)} />

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Faturamento no período"
          value={formatCurrency(metrics.faturamento)}
          highlightValue
          highlightTitle
        />
        <MetricCard title="Inscrições pagas" value={metrics.inscricoesPagas} />
        <MetricCard
          title="Inscrições com pagamento em aberto"
          value={metrics.inscricoesEmAberto}
        />
        <MetricCard title="Nº de assinantes" value={metrics.numeroAssinantes} />
        <MetricCard
          title="Margem bruta da Runlab"
          value={formatCurrency(metrics.margemBruta)}
          highlightValue
          highlightTitle
        />
        <MetricCard
          title="Comissão de parceiros"
          value={formatCurrency(metrics.comissaoParceiros)}
        />
      </div>

      {/* Gráficos de pizza */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6 bg-card">
          <h3 className="text-sm text-muted-foreground mb-4">
            Receita por tipo de recebimento
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={receiptData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={0}
                dataKey="value"
                label={renderPieLabel}
                labelLine={false}
              >
                {receiptData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                content={<CustomLegend />}
                layout="vertical"
                align="right"
                verticalAlign="middle"
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6 bg-card">
          <h3 className="text-sm text-muted-foreground mb-4">
            Comissão por tipo de parceiro
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={partnerData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                paddingAngle={0}
                dataKey="value"
                label={renderPieLabel}
                labelLine={false}
              >
                {partnerData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                content={<CustomLegend />}
                layout="vertical"
                align="right"
                verticalAlign="middle"
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Gráfico de barras (ano atual, mês selecionado destacado) */}
      <Card className="p-6 bg-card">
        <h3 className="text-sm text-muted-foreground mb-6">
          Inscrições realizadas em {currentYear}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="month"
              stroke="#888"
              tick={{ fill: "#888" }}
            />
            <YAxis
              stroke="#888"
              tick={{ fill: "#888" }}
              allowDecimals={false}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              label={{
                position: "insideTop",
                fill: "#000",
                formatter: (value: number) => (value > 0 ? String(value) : ""),
              }}
            >
              {monthlyData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.monthIndex === currentMonth ? "#CCF725" : index % 2 === 0 ? "#B3D91F" : "#EEFF99"
                  }
                  stroke={entry.monthIndex === currentMonth ? "#8B9D00" : undefined}
                  strokeWidth={entry.monthIndex === currentMonth ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground mt-2">
          Barra destacada: {MONTHS[currentMonth]} (período selecionado).
        </p>
      </Card>

      <SolicitacoesSaqueDialog
        open={solicitacoesOpen}
        onOpenChange={setSolicitacoesOpen}
      />
    </div>
  );
};

function renderPieLabel({
  cx,
  cy,
  midAngle,
  outerRadius,
  name,
  value,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  name: string;
  value: number;
}) {
  const radius = outerRadius * 0.65;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);
  return (
    <text
      x={x}
      y={y}
      fill="#000"
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={11}
      fontWeight={500}
    >
      <tspan x={x} dy="0">
        {name}
      </tspan>
      <tspan x={x} dy="14">
        ({value}%)
      </tspan>
    </text>
  );
}
