import {
  BarChart3,
  Clipboard,
  CloudSun,
  Download,
  FileText,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Bar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapPicker, type MapPoint } from "@/components/MapPicker";
import {
  fetchClimateNormals,
  searchLocations,
  type LocationSearchResult,
} from "@/lib/open-meteo";
import {
  EMPTY_MONTHLY_INPUTS,
  MONTHS,
  SUPPORTED_LATITUDES,
  calculateWaterBalance,
  nearestFactorSelection,
  type FactorSelection,
  type Hemisphere,
  type MonthlyInput,
  type MonthlyWaterBalance,
} from "$/water-balance";

type SourceState = "manual" | "imported";

const DEFAULT_START_YEAR = 1991;
const DEFAULT_END_YEAR = 2020;

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatCoordinate(value: number): string {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
  });
}

function parseInputValue(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));
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

export function App() {
  const [monthlyInputs, setMonthlyInputs] =
    useState<MonthlyInput[]>(EMPTY_MONTHLY_INPUTS);
  const [sourceState, setSourceState] = useState<SourceState>("manual");
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSearchResult | null>(null);
  const [factorSelection, setFactorSelection] = useState<FactorSelection>({
    hemisphere: "south",
    latitude: 30,
  });
  const [query, setQuery] = useState("");
  const [locationResults, setLocationResults] = useState<LocationSearchResult[]>(
    [],
  );
  const [startYear, setStartYear] = useState(DEFAULT_START_YEAR);
  const [endYear, setEndYear] = useState(DEFAULT_END_YEAR);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [missingMonths, setMissingMonths] = useState<number[]>([]);

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
        sourceState,
      }),
    [waterBalance, selectedLocation, selectedPoint, startYear, endYear, sourceState],
  );
  const chartData = waterBalance.rows.map((row) => ({
    month: row.shortName,
    precipitation: roundForChart(row.precipitation),
    correctedEtp: roundForChart(row.correctedEtp),
    balance: roundForChart(row.balance),
  }));
  const canImport = selectedPoint !== null && startYear <= endYear;

  const updatePoint = (point: MapPoint, location: LocationSearchResult | null) => {
    setSelectedPoint(point);
    setSelectedLocation(location);
    setFactorSelection(nearestFactorSelection(point.latitude));
    setStatusMessage("Local selecionado. Importe a normal climatologica ou edite os dados manualmente.");
  };

  const handleSearch = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSearching(true);

    try {
      const results = await searchLocations(query);
      setLocationResults(results);
      if (!results.length) {
        setStatusMessage("Nenhum local encontrado para a busca.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha na busca.");
    } finally {
      setIsSearching(false);
    }
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
      });
      setMonthlyInputs(result.inputs);
      setMissingMonths(result.missingMonths);
      setSourceState("imported");
      setStatusMessage(
        result.missingMonths.length
          ? "Importacao concluida com meses incompletos. Revise a tabela."
          : "Normal climatologica importada. Os campos continuam editaveis.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nao foi possivel importar dados climaticos.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const updateMonthlyInput = (
    index: number,
    field: keyof MonthlyInput,
    value: string,
  ) => {
    setMonthlyInputs((current) =>
      current.map((input, inputIndex) =>
        inputIndex === index ? { ...input, [field]: parseInputValue(value) } : input,
      ),
    );
    setSourceState("manual");
  };

  const clearInputs = () => {
    setMonthlyInputs(EMPTY_MONTHLY_INPUTS);
    setMissingMonths([]);
    setSourceState("manual");
    setStatusMessage("Tabela limpa para preenchimento manual.");
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(report);
    setStatusMessage("Relatorio copiado.");
  };

  const exportCsv = () => {
    const csv = buildCsv(waterBalance.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ecocalc-balanco-hidrico.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="brand-mark">
          <Waves className="size-5" />
          <span>Ecocalc</span>
        </div>
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Geoquimica aplicada ao ensino</p>
            <h1>Balanço hídrico.</h1>
            <p className="hero-copy">
              Selecione um local, importe uma normal climatologica e transforme a
              planilha em uma experiencia exploravel para aula, pesquisa e
              trabalho.
            </p>
          </div>
          <div className="hero-metrics" aria-label="Resumo anual">
            <MetricCard
              label="P anual"
              value={`${formatNumber(waterBalance.annual.precipitationTotal)} mm`}
            />
            <MetricCard
              label="ETP corr."
              value={`${formatNumber(waterBalance.annual.correctedEtpTotal)} mm`}
            />
            <MetricCard
              label="BH anual"
              value={`${formatNumber(waterBalance.annual.balanceTotal)} mm`}
              tone={
                (waterBalance.annual.balanceTotal ?? 0) < 0
                  ? "negative"
                  : "positive"
              }
            />
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel map-panel">
          <PanelTitle
            icon={<MapPin className="size-4" />}
            title="Local e clima"
            description="Busque uma cidade ou clique no mapa."
          />

          <div className="search-row">
            <div className="field grow">
              <label htmlFor="location-search">Buscar local</label>
              <input
                id="location-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSearch();
                  }
                }}
                placeholder="Ex.: Niteroi, RJ"
              />
            </div>
            <button
              className="icon-button solid"
              type="button"
              onClick={() => void handleSearch()}
              disabled={isSearching}
              aria-label="Buscar local"
            >
              {isSearching ? <Loader2 className="spin" /> : <Search />}
            </button>
          </div>

          {locationResults.length > 0 && (
            <div className="location-list">
              {locationResults.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() =>
                    updatePoint(
                      {
                        latitude: location.latitude,
                        longitude: location.longitude,
                      },
                      location,
                    )
                  }
                >
                  <strong>{location.name}</strong>
                  <span>{[location.admin1, location.country].filter(Boolean).join(", ")}</span>
                </button>
              ))}
            </div>
          )}

          <MapPicker
            point={selectedPoint}
            onPointChange={(point) => updatePoint(point, null)}
          />

          <div className="period-grid">
            <div className="field">
              <label htmlFor="start-year">Inicio</label>
              <input
                id="start-year"
                type="number"
                value={startYear}
                min={1940}
                max={new Date().getFullYear() - 1}
                onChange={(event) => setStartYear(Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="end-year">Fim</label>
              <input
                id="end-year"
                type="number"
                value={endYear}
                min={1940}
                max={new Date().getFullYear() - 1}
                onChange={(event) => setEndYear(Number(event.target.value))}
              />
            </div>
            <button
              className="action-button"
              type="button"
              disabled={!canImport || isImporting}
              onClick={() => void handleImportClimate()}
            >
              {isImporting ? <Loader2 className="spin" /> : <CloudSun />}
              Importar normal
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
        </div>

        <div className="panel controls-panel">
          <PanelTitle
            icon={<SlidersHorizontal className="size-4" />}
            title="Fatores e entrada manual"
            description="A latitude pode ser ajustada para discussao metodologica."
          />
          <div className="factor-grid">
            <div className="field">
              <label htmlFor="hemisphere">Hemisferio</label>
              <select
                id="hemisphere"
                value={factorSelection.hemisphere}
                onChange={(event) => {
                  const hemisphere = event.target.value as Hemisphere;
                  setFactorSelection({
                    hemisphere,
                    latitude: SUPPORTED_LATITUDES[hemisphere][0],
                  });
                }}
              >
                <option value="south">Sul</option>
                <option value="north">Norte</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="latitude">Latitude de fator</label>
              <select
                id="latitude"
                value={factorSelection.latitude}
                onChange={(event) =>
                  setFactorSelection({
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
            <button className="secondary-button" type="button" onClick={clearInputs}>
              Limpar dados
            </button>
          </div>

          <div className="source-pill" data-state={sourceState}>
            {sourceState === "imported"
              ? "Dados importados e editaveis"
              : "Preenchimento manual"}
          </div>

          {(statusMessage || errorMessage || waterBalance.errors.length > 0) && (
            <div className={errorMessage ? "notice error" : "notice"}>
              {errorMessage ? <TriangleAlert className="size-4" /> : null}
              <span>
                {errorMessage ??
                  statusMessage ??
                  waterBalance.errors.slice(0, 2).join(" ")}
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
      </section>

      <section className="panel table-panel">
        <PanelTitle
          icon={<BarChart3 className="size-4" />}
          title="Tabela de calculo"
          description="Precipitacao e temperatura sao entradas; as demais colunas sao calculadas."
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
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
              {waterBalance.rows.map((row, index) => (
                <tr key={row.month}>
                  <td>{row.monthName}</td>
                  <td>
                    <input
                      value={monthlyInputs[index]?.precipitation ?? ""}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateMonthlyInput(index, "precipitation", event.target.value)
                      }
                      aria-label={`Precipitacao de ${row.monthName}`}
                    />
                  </td>
                  <td>
                    <input
                      value={monthlyInputs[index]?.temperature ?? ""}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateMonthlyInput(index, "temperature", event.target.value)
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

      <section className="analysis-grid">
        <div className="panel chart-panel">
          <PanelTitle
            icon={<BarChart3 className="size-4" />}
            title="Grafico mensal"
            description="Comparacao entre agua disponivel, demanda potencial e saldo."
          />
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${formatNumber(Number(value), 1)} mm`}
                  labelFormatter={(label) => `Mes: ${label}`}
                />
                <Bar
                  dataKey="precipitation"
                  name="Precipitacao"
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
        </div>

        <div className="panel report-panel">
          <PanelTitle
            icon={<FileText className="size-4" />}
            title="Relatorio didatico"
            description="Texto local para copiar em aula, trabalho ou pesquisa."
          />
          <textarea value={report} readOnly />
          <div className="button-row">
            <button className="action-button" type="button" onClick={() => void copyReport()}>
              <Clipboard />
              Copiar relatorio
            </button>
            <button className="secondary-button" type="button" onClick={exportCsv}>
              <Download />
              Exportar CSV
            </button>
          </div>
        </div>
      </section>

      <section className="learning-band">
        <div>
          <h2>Leitura rapida</h2>
          <p>
            BH positivo indica excedente mensal entre precipitacao e ETP
            corrigida. BH negativo indica deficit potencial, quando a demanda
            evaporativa supera a entrada de agua pela chuva.
          </p>
        </div>
        <div className="formula-strip">
          <span>i = (T / 5)^1,514</span>
          <span>I = soma(i)</span>
          <span>ETP = 16 * (10T / I)^a</span>
          <span>BH = P - ETPcorr</span>
        </div>
      </section>
    </main>
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
  icon: React.ReactNode;
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
  sourceState: SourceState;
}): string {
  const { result, location, point, startYear, endYear, sourceState } = params;
  const deficit = result.annual.maxDeficit;
  const surplus = result.annual.maxSurplus;
  const coordinates = point
    ? `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}`
    : "nao informado";

  return [
    "Relatorio didatico - Balanço hidrico",
    "",
    `Local: ${locationLabel(location)}`,
    `Coordenadas: ${coordinates}`,
    `Periodo climatico: ${startYear}-${endYear}`,
    `Fonte dos dados: ${
      sourceState === "imported"
        ? "Open-Meteo Historical Weather API"
        : "preenchimento manual"
    }`,
    "",
    "Resumo anual:",
    `- Precipitacao total: ${formatNumber(result.annual.precipitationTotal)} mm`,
    `- ETP corrigida total: ${formatNumber(result.annual.correctedEtpTotal)} mm`,
    `- Balanço hidrico anual: ${formatNumber(result.annual.balanceTotal)} mm`,
    `- Indice calorimetrico anual I: ${formatNumber(result.annual.annualHeatIndex, 3)}`,
    `- Expoente a: ${formatNumber(result.annual.exponentA, 3)}`,
    "",
    `Maior deficit: ${deficit ? `${deficit.monthName} (${formatNumber(deficit.balance)} mm)` : "nao calculado"}`,
    `Maior superavit: ${surplus ? `${surplus.monthName} (${formatNumber(surplus.balance)} mm)` : "nao calculado"}`,
    "",
    "Interpretacao:",
    "BH positivo indica excedente mensal entre precipitacao e evapotranspiracao potencial corrigida. BH negativo indica deficit potencial, quando a demanda evaporativa supera a entrada de agua pela chuva.",
    "",
    "Formulas:",
    "i = (T / 5)^1,514; I = soma(i); a = 675e-9 * I^3 - 771e-7 * I^2 + 0,01792 * I + 0,49239; ETP = 16 * (10 * T / I)^a; ETP corrigida = ETP * fator; BH = P - ETP corrigida.",
  ].join("\n");
}

function buildCsv(rows: MonthlyWaterBalance[]): string {
  const header = [
    "mes",
    "precipitacao_mm",
    "temperatura_c",
    "fator",
    "indice_i",
    "etp_mm",
    "etp_corrigida_mm",
    "balanco_hidrico_mm",
  ];
  const body = rows.map((row) =>
    [
      row.monthName,
      csvNumber(row.precipitation),
      csvNumber(row.temperature),
      csvNumber(row.correctionFactor),
      csvNumber(row.monthlyHeatIndex),
      csvNumber(row.etp),
      csvNumber(row.correctedEtp),
      csvNumber(row.balance),
    ].join(","),
  );

  return [header.join(","), ...body].join("\n");
}

function csvNumber(value: number | null): string {
  return value === null ? "" : value.toString();
}

function roundForChart(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}
