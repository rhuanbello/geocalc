import {
  BarChart3,
  BookOpen,
  Calculator,
  Clipboard,
  CloudSun,
  Database,
  Download,
  FileText,
  Info,
  Loader2,
  MapPin,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LocationCombobox } from "@/components/LocationCombobox";
import { MapPicker, type MapPoint } from "@/components/MapPicker";
import {
  fetchClimateNormals,
  type LocationSearchResult,
} from "@/lib/open-meteo";
import {
  MONTHS,
  SUPPORTED_LATITUDES,
  calculateWaterBalance,
  nearestFactorSelection,
  type FactorSelection,
  type Hemisphere,
  type MonthlyInput,
  type MonthlyWaterBalance,
} from "$/water-balance";
import { formatIsoDatePtBr } from "$/date-format";

type SourceState = "manual" | "imported";

type MonthlyTextInput = {
  precipitation: string;
  temperature: string;
};

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_START_YEAR = 1990;
const DEFAULT_END_YEAR = CURRENT_YEAR;
const EMPTY_MONTHLY_TEXT_INPUTS: MonthlyTextInput[] = MONTHS.map(() => ({
  precipitation: "",
  temperature: "",
}));

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatInputNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }

  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

function parseDecimalText(value: string): number | null {
  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed === "-" ||
    trimmed.endsWith(",") ||
    trimmed.endsWith(".")
  ) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function locationLabel(location: LocationSearchResult | null): string {
  if (!location) {
    return "Ponto manual";
  }

  return [location.name, location.admin1, location.country]
    .filter(Boolean)
    .join(", ");
}

function getEffectiveEndDate(endYear: number): string {
  const requestedEnd = new Date(Date.UTC(endYear, 11, 31));
  const safeCurrentDate = new Date();
  safeCurrentDate.setDate(safeCurrentDate.getDate() - 5);

  const effectiveEnd =
    requestedEnd.getTime() < safeCurrentDate.getTime()
      ? requestedEnd
      : safeCurrentDate;

  return effectiveEnd.toISOString().slice(0, 10);
}

export function App() {
  const [monthlyTextInputs, setMonthlyTextInputs] = useState<MonthlyTextInput[]>(
    EMPTY_MONTHLY_TEXT_INPUTS,
  );
  const [sourceState, setSourceState] = useState<SourceState>("manual");
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSearchResult | null>(null);
  const [factorSelection, setFactorSelection] = useState<FactorSelection>({
    hemisphere: "south",
    latitude: 30,
  });
  const [startYear, setStartYear] = useState(DEFAULT_START_YEAR);
  const [endYear, setEndYear] = useState(DEFAULT_END_YEAR);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingMonths, setMissingMonths] = useState<number[]>([]);

  const monthlyInputs = useMemo<MonthlyInput[]>(
    () =>
      monthlyTextInputs.map((input) => ({
        precipitation: parseDecimalText(input.precipitation),
        temperature: parseDecimalText(input.temperature),
      })),
    [monthlyTextInputs],
  );
  const effectiveEndDate = useMemo(() => getEffectiveEndDate(endYear), [endYear]);
  const waterBalance = useMemo(
    () => calculateWaterBalance(monthlyInputs, factorSelection),
    [monthlyInputs, factorSelection],
  );
  const report = useMemo(
    () =>
      buildReport({
        result: waterBalance,
        location: selectedLocation,
        point: selectedPoint,
        startYear,
        endYear,
        effectiveEndDate,
        sourceState,
      }),
    [
      waterBalance,
      selectedLocation,
      selectedPoint,
      startYear,
      endYear,
      effectiveEndDate,
      sourceState,
    ],
  );
  const chartData = waterBalance.rows.map((row) => ({
    month: row.shortName,
    precipitation: roundForChart(row.precipitation),
    correctedEtp: roundForChart(row.correctedEtp),
    balance: roundForChart(row.balance),
  }));
  const hasAnyInput = monthlyInputs.some(
    (input) => input.precipitation !== null || input.temperature !== null,
  );
  const canImport =
    selectedPoint !== null &&
    startYear >= 1940 &&
    endYear >= 1940 &&
    startYear <= endYear &&
    endYear <= CURRENT_YEAR;

  const updatePoint = (point: MapPoint, location: LocationSearchResult | null) => {
    setSelectedPoint(point);
    setSelectedLocation(location);
    setFactorSelection(nearestFactorSelection(point.latitude));
    setStatusMessage(
      "Local selecionado. Você pode preencher a tabela com dados climáticos ou editar os valores manualmente.",
    );
  };

  const clearLocation = () => {
    setSelectedPoint(null);
    setSelectedLocation(null);
    setStatusMessage("Local removido. Busque uma cidade ou selecione um ponto no mapa.");
  };

  const handleImportClimate = async () => {
    if (!selectedPoint) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);
    setIsImporting(true);

    try {
      const result = await fetchClimateNormals({
        latitude: selectedPoint.latitude,
        longitude: selectedPoint.longitude,
        timezone: selectedLocation?.timezone ?? "auto",
        startYear,
        endYear,
        effectiveEndDate,
      });
      setMonthlyTextInputs(
        result.inputs.map((input) => ({
          precipitation: formatInputNumber(input.precipitation),
          temperature: formatInputNumber(input.temperature),
        })),
      );
      setMissingMonths(result.missingMonths);
      setSourceState("imported");
      setStatusMessage(
        result.missingMonths.length
          ? "Importação concluída com meses sem dados completos. Revise a tabela."
          : "Dados climáticos importados. Os campos continuam editáveis.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível importar dados climáticos.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const updateMonthlyInput = (
    index: number,
    field: keyof MonthlyTextInput,
    value: string,
  ) => {
    setMonthlyTextInputs((current) =>
      current.map((input, inputIndex) =>
        inputIndex === index ? { ...input, [field]: value } : input,
      ),
    );
    setSourceState("manual");
  };

  const clearInputs = () => {
    setMonthlyTextInputs(EMPTY_MONTHLY_TEXT_INPUTS);
    setMissingMonths([]);
    setSourceState("manual");
    setStatusMessage("Tabela limpa para preenchimento manual.");
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(report);
    setStatusMessage("Relatório copiado.");
  };

  const exportExcel = async () => {
    const { exportWaterBalanceWorkbook } = await import("@/lib/excel-export");

    await exportWaterBalanceWorkbook({
      result: waterBalance,
      location: selectedLocation,
      point: selectedPoint,
      startYear,
      endYear,
      effectiveEndDate,
      sourceState,
    });
    setStatusMessage("Planilha Excel exportada.");
  };

  return (
    <div className="app-layout">
      <AppSidebar />

      <main className="app-shell">
        <ModuleHeader result={waterBalance} />

        <FactorStrip
          factorSelection={factorSelection}
          onFactorSelectionChange={setFactorSelection}
          onClear={clearInputs}
        />

        <ClimatePanel
          selectedLocation={selectedLocation}
          selectedPoint={selectedPoint}
          startYear={startYear}
          endYear={endYear}
          effectiveEndDate={effectiveEndDate}
          canImport={canImport}
          isImporting={isImporting}
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          missingMonths={missingMonths}
          waterBalanceErrors={waterBalance.errors}
          onPointChange={updatePoint}
          onLocationClear={clearLocation}
          onLocationSearchError={setErrorMessage}
          onStartYearChange={setStartYear}
          onEndYearChange={setEndYear}
          onImportClimate={() => void handleImportClimate()}
        />

        <CalculationTable
          rows={waterBalance.rows}
          inputs={monthlyTextInputs}
          hasAnyInput={hasAnyInput}
          onInputChange={updateMonthlyInput}
        />

        <VariableGuide />

        <FullWidthChart chartData={chartData} hasAnyInput={hasAnyInput} />

        <ReportPanel report={report} onCopy={copyReport} onExport={exportExcel} />

        <LearningBand />
      </main>
    </div>
  );
}

function AppSidebar() {
  const logoUrl = `${import.meta.env.BASE_URL}brand/logo-geoquimica-colorido.png`;

  return (
    <aside className="app-sidebar" aria-label="Navegação principal">
      <div className="institution-brand">
        <img src={logoUrl} alt="PPG Geoquímica UFF" />
        <div>
          <strong className="wordmark">GeoCalc</strong>
          <span>PPG Geoquímica / UFF</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <a className="active" href="#balanco-hidrico" aria-current="page">
          <Calculator />
          <span>Balanço Hídrico</span>
        </a>
        <span className="disabled">
          <Database />
          <span>Solos e sedimentos</span>
        </span>
        <span className="disabled">
          <BarChart3 />
          <span>Modelos geoquímicos</span>
        </span>
        <span className="disabled">
          <BookOpen />
          <span>Materiais de aula</span>
        </span>
      </nav>

      <p className="sidebar-note">
        Ferramenta educacional para cálculo e interpretação do balanço hídrico.
        <span>
          Cálculos fornecidos por Edison Dausacker Bidone.
        </span>
      </p>
    </aside>
  );
}

function ModuleHeader({
  result,
}: {
  result: ReturnType<typeof calculateWaterBalance>;
}) {
  return (
    <header className="module-header" id="balanco-hidrico">
      <div>
        <p className="eyebrow">Módulo ativo</p>
        <h1>Balanço hídrico</h1>
        <p>
          Selecione um local, preencha dados climáticos e acompanhe como chuva,
          temperatura, fator mensal e ETP formam o saldo hídrico.
        </p>
      </div>

      <div className="header-metrics" aria-label="Resumo anual">
        <MetricCard
          label="P anual"
          value={`${formatNumber(result.annual.precipitationTotal)} mm`}
        />
        <MetricCard
          label="ETP corr."
          value={`${formatNumber(result.annual.correctedEtpTotal)} mm`}
        />
        <MetricCard
          label="BH anual"
          value={`${formatNumber(result.annual.balanceTotal)} mm`}
          tone={(result.annual.balanceTotal ?? 0) < 0 ? "negative" : "positive"}
        />
      </div>
    </header>
  );
}

function FactorStrip({
  factorSelection,
  onFactorSelectionChange,
  onClear,
}: {
  factorSelection: FactorSelection;
  onFactorSelectionChange: (selection: FactorSelection) => void;
  onClear: () => void;
}) {
  return (
    <section className="panel factor-strip">
      <PanelTitle
        icon={<SlidersHorizontal className="size-4" />}
        title="Fatores de correção"
        description="A latitude de fator é sugerida automaticamente pela coordenada selecionada e pode ser ajustada quando necessário."
      />

      <div className="factor-controls">
        <div className="field compact-field">
          <label htmlFor="hemisphere">Hemisfério</label>
          <select
            id="hemisphere"
            value={factorSelection.hemisphere}
            onChange={(event) => {
              const hemisphere = event.target.value as Hemisphere;
              onFactorSelectionChange({
                hemisphere,
                latitude: SUPPORTED_LATITUDES[hemisphere][0],
              });
            }}
          >
            <option value="south">Sul</option>
            <option value="north">Norte</option>
          </select>
        </div>
        <div className="field compact-field">
          <label htmlFor="latitude">Latitude de fator</label>
          <select
            id="latitude"
            value={factorSelection.latitude}
            onChange={(event) =>
              onFactorSelectionChange({
                ...factorSelection,
                latitude: Number(event.target.value) as FactorSelection["latitude"],
              })
            }
          >
            {SUPPORTED_LATITUDES[factorSelection.hemisphere].map((latitude) => (
              <option key={latitude} value={latitude}>
                {latitude} graus
              </option>
            ))}
          </select>
        </div>
        <button className="secondary-button" type="button" onClick={onClear}>
          Limpar dados
        </button>
      </div>
    </section>
  );
}

function ClimatePanel({
  selectedLocation,
  selectedPoint,
  startYear,
  endYear,
  effectiveEndDate,
  canImport,
  isImporting,
  statusMessage,
  errorMessage,
  missingMonths,
  waterBalanceErrors,
  onPointChange,
  onLocationClear,
  onLocationSearchError,
  onStartYearChange,
  onEndYearChange,
  onImportClimate,
}: {
  selectedLocation: LocationSearchResult | null;
  selectedPoint: MapPoint | null;
  startYear: number;
  endYear: number;
  effectiveEndDate: string;
  canImport: boolean;
  isImporting: boolean;
  statusMessage: string | null;
  errorMessage: string | null;
  missingMonths: number[];
  waterBalanceErrors: string[];
  onPointChange: (point: MapPoint, location: LocationSearchResult | null) => void;
  onLocationClear: () => void;
  onLocationSearchError: (message: string | null) => void;
  onStartYearChange: (value: number) => void;
  onEndYearChange: (value: number) => void;
  onImportClimate: () => void;
}) {
  return (
    <section className="panel climate-panel">
      <PanelTitle
        icon={<MapPin className="size-4" />}
        title="Local e clima"
        description="Busque uma cidade ou selecione um ponto no mapa para orientar os fatores e a importação climática."
      />

      <div className="climate-grid">
        <div className="climate-controls">
          <LocationCombobox
            value={selectedLocation}
            onError={onLocationSearchError}
            onChange={(location) => {
              if (!location) {
                onLocationClear();
                return;
              }

              onPointChange(
                {
                  latitude: location.latitude,
                  longitude: location.longitude,
                },
                location,
              );
            }}
          />

          <div className="period-grid">
            <div className="field">
              <label htmlFor="start-year">Início</label>
              <input
                id="start-year"
                type="number"
                value={startYear}
                min={1940}
                max={CURRENT_YEAR}
                onChange={(event) => onStartYearChange(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="end-year">Fim</label>
              <input
                id="end-year"
                type="number"
                value={endYear}
                min={1940}
                max={CURRENT_YEAR}
                onChange={(event) => onEndYearChange(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="import-card">
            <div>
              <strong>Preencher com dados climáticos</strong>
              <span>
                Usa Open-Meteo para calcular médias mensais do período
                selecionado. Data final efetiva:{" "}
                {formatIsoDatePtBr(effectiveEndDate)}.
              </span>
            </div>
            <button
              className="action-button climate-cta"
              type="button"
              disabled={!canImport || isImporting}
              onClick={onImportClimate}
            >
              {isImporting ? <Loader2 className="spin" /> : <CloudSun />}
              Preencher com dados climáticos
            </button>
          </div>

          <div className="location-summary">
            <span>{locationLabel(selectedLocation)}</span>
            {selectedPoint ? (
              <strong>
                {formatCoordinate(selectedPoint.latitude)},{" "}
                {formatCoordinate(selectedPoint.longitude)}
              </strong>
            ) : (
              <strong>Sem ponto selecionado</strong>
            )}
          </div>

          {!selectedPoint && (
            <div className="empty-inline">
              <Info />
              <span>
                Selecione um local na busca ou clique no mapa para habilitar a
                importação climática.
              </span>
            </div>
          )}

          {(statusMessage || errorMessage || waterBalanceErrors.length > 0) && (
            <div className={errorMessage ? "notice error" : "notice"}>
              {errorMessage ? <TriangleAlert className="size-4" /> : null}
              <span>
                {errorMessage ??
                  statusMessage ??
                  waterBalanceErrors.slice(0, 2).join(" ")}
              </span>
            </div>
          )}

          {missingMonths.length > 0 && (
            <div className="notice warning">
              Meses incompletos:{" "}
              {missingMonths
                .map((month) => MONTHS[month - 1]?.short)
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>

        <MapPicker
          point={selectedPoint}
          onPointChange={(point) => onPointChange(point, null)}
        />
      </div>
    </section>
  );
}

function CalculationTable({
  rows,
  inputs,
  hasAnyInput,
  onInputChange,
}: {
  rows: MonthlyWaterBalance[];
  inputs: MonthlyTextInput[];
  hasAnyInput: boolean;
  onInputChange: (
    index: number,
    field: keyof MonthlyTextInput,
    value: string,
  ) => void;
}) {
  return (
    <section className="panel table-panel">
      <PanelTitle
        icon={<BarChart3 className="size-4" />}
        title="Tabela de cálculo"
        description="Precipitação e temperatura são entradas; as demais colunas são calculadas automaticamente."
      />
      {!hasAnyInput && (
        <div className="empty-inline table-empty">
          <Info />
          <span>
            A tabela começa vazia. Preencha manualmente os campos de P e T ou
            use dados climáticos para popular os meses.
          </span>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>P (mm)</th>
              <th>T (C)</th>
              <th>Fator</th>
              <th>i</th>
              <th>ETP</th>
              <th>ETP corr.</th>
              <th>BH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.month}>
                <td>{row.monthName}</td>
                <td>
                  <input
                    value={inputs[index]?.precipitation ?? ""}
                    inputMode="decimal"
                    onChange={(event) =>
                      onInputChange(index, "precipitation", event.target.value)
                    }
                    aria-label={`Precipitação de ${row.monthName}`}
                  />
                </td>
                <td>
                  <input
                    value={inputs[index]?.temperature ?? ""}
                    inputMode="decimal"
                    onChange={(event) =>
                      onInputChange(index, "temperature", event.target.value)
                    }
                    aria-label={`Temperatura de ${row.monthName}`}
                  />
                </td>
                <td>{formatNumber(row.correctionFactor, 2)}</td>
                <td>{formatNumber(row.monthlyHeatIndex, 2)}</td>
                <td>{formatNumber(row.etp, 1)}</td>
                <td>{formatNumber(row.correctedEtp, 1)}</td>
                <td className={(row.balance ?? 0) < 0 ? "negative" : "positive"}>
                  {formatNumber(row.balance, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FullWidthChart({
  chartData,
  hasAnyInput,
}: {
  chartData: Array<{
    month: string;
    precipitation: number | null;
    correctedEtp: number | null;
    balance: number | null;
  }>;
  hasAnyInput: boolean;
}) {
  return (
    <section className="panel chart-panel">
      <PanelTitle
        icon={<BarChart3 className="size-4" />}
        title="Gráfico mensal"
        description="Comparação entre água disponível, demanda potencial e saldo."
      />
      {hasAnyInput ? (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ left: 0, right: 20, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) => `${formatNumber(Number(value), 1)} mm`}
                labelFormatter={(label) => `Mês: ${label}`}
              />
              <Bar
                dataKey="precipitation"
                name="Precipitação"
                fill="var(--water)"
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="correctedEtp"
                name="ETP corrigida"
                stroke="var(--sun)"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="balance"
                name="BH"
                stroke="var(--leaf)"
                strokeWidth={3}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-panel">
          <BarChart3 />
          <strong>Gráfico aguardando dados</strong>
          <span>
            Insira precipitação e temperatura ou importe dados climáticos para
            visualizar as séries mensais.
          </span>
        </div>
      )}
    </section>
  );
}

function ReportPanel({
  report,
  onCopy,
  onExport,
}: {
  report: string;
  onCopy: () => Promise<void>;
  onExport: () => Promise<void>;
}) {
  return (
    <section className="panel report-panel">
      <PanelTitle
        icon={<FileText className="size-4" />}
        title="Relatório didático"
        description="Texto local para copiar em aula, trabalho ou pesquisa."
      />
      <textarea value={report} readOnly />
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void onCopy()}>
          <Clipboard />
          Copiar relatório
        </button>
        <button className="secondary-button" type="button" onClick={() => void onExport()}>
          <Download />
          Exportar Excel
        </button>
      </div>
    </section>
  );
}

function VariableGuide() {
  const variables = [
    ["P", "Precipitação mensal acumulada, em milímetros."],
    ["T", "Temperatura média mensal, em graus Celsius."],
    ["Fator", "Correção mensal associada ao hemisfério e à latitude."],
    ["i", "Índice calorimétrico mensal calculado a partir da temperatura."],
    ["I", "Soma anual dos índices calorimétricos mensais."],
    ["a", "Expoente anual usado na fórmula de Thornthwaite."],
    ["ETP", "Evapotranspiração potencial antes da correção mensal."],
    ["ETP corr.", "ETP multiplicada pelo fator mensal de correção."],
    ["BH", "Saldo mensal entre chuva e ETP corrigida."],
  ];

  return (
    <section className="panel variable-guide">
      <PanelTitle
        icon={<Info className="size-4" />}
        title="Entenda as variáveis"
        description="Uma legenda rápida para interpretar a tabela de cálculo e o relatório."
      />
      <div className="variable-grid">
        {variables.map(([term, description]) => (
          <div className="variable-card" key={term}>
            <strong>{term}</strong>
            <span>{description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LearningBand() {
  return (
    <section className="learning-band">
      <div>
        <h2>Leitura rápida</h2>
        <p>
          BH positivo indica excedente mensal entre precipitação e ETP
          corrigida. BH negativo indica déficit potencial, quando a demanda
          evaporativa supera a entrada de água pela chuva.
        </p>
      </div>
      <div className="formula-strip">
        <span>i = (T / 5)^1,514</span>
        <span>I = soma(i)</span>
        <span>ETP = 16 * (10T / I)^a</span>
        <span>BH = P - ETPcorr</span>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="metric-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="panel-title">
      <div className="panel-title-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function buildReport(params: {
  result: ReturnType<typeof calculateWaterBalance>;
  location: LocationSearchResult | null;
  point: MapPoint | null;
  startYear: number;
  endYear: number;
  effectiveEndDate: string;
  sourceState: SourceState;
}): string {
  const {
    result,
    location,
    point,
    startYear,
    endYear,
    effectiveEndDate,
    sourceState,
  } = params;
  const deficit = result.annual.maxDeficit;
  const surplus = result.annual.maxSurplus;
  const coordinates = point
    ? `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`
    : "não informado";
  const completionNote = result.isComplete
    ? "Todos os meses possuem entradas suficientes para o cálculo anual."
    : "O cálculo anual será completado quando todos os meses tiverem precipitação e temperatura.";

  return [
    "Relatório didático - Balanço hídrico",
    "",
    `Local: ${locationLabel(location)}`,
    `Coordenadas: ${coordinates}`,
    `Período climático: ${startYear}-${endYear}`,
    `Data final efetiva da importação: ${formatIsoDatePtBr(effectiveEndDate)}`,
    `Fonte dos dados: ${
      sourceState === "imported"
        ? "Open-Meteo Historical Weather API"
        : "entrada manual"
    }`,
    "Base técnica: cálculos fornecidos por Edison Dausacker Bidone.",
    `Situação: ${completionNote}`,
    "",
    "Resumo anual:",
    `- Precipitação total: ${formatNumber(result.annual.precipitationTotal)} mm`,
    `- ETP corrigida total: ${formatNumber(result.annual.correctedEtpTotal)} mm`,
    `- Balanço hídrico anual: ${formatNumber(result.annual.balanceTotal)} mm`,
    `- Índice calorimétrico anual I: ${formatNumber(result.annual.annualHeatIndex, 3)}`,
    `- Expoente a: ${formatNumber(result.annual.exponentA, 3)}`,
    "",
    `Maior déficit: ${deficit ? `${deficit.monthName} (${formatNumber(deficit.balance)} mm)` : "não calculado"}`,
    `Maior superávit: ${surplus ? `${surplus.monthName} (${formatNumber(surplus.balance)} mm)` : "não calculado"}`,
    "",
    "Interpretação:",
    "BH positivo indica excedente mensal entre precipitação e evapotranspiração potencial corrigida. BH negativo indica déficit potencial, quando a demanda evaporativa supera a entrada de água pela chuva.",
    "",
    "Fórmulas:",
    "i = (T / 5)^1,514; I = soma(i); a = 675e-9 * I^3 - 771e-7 * I^2 + 0,01792 * I + 0,49239; ETP = 16 * (10 * T / I)^a; ETP corrigida = ETP * fator; BH = P - ETP corrigida.",
  ].join("\n");
}

function roundForChart(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}
