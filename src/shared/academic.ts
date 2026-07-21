export type ReferenceSource = {
  label: string;
  description: string;
  href?: string;
};

export type MethodologySection = {
  title: string;
  body: string;
};

export type ClimatePeriodPresetId =
  | "1940-1970"
  | "1971-2000"
  | "1991-2020"
  | "custom";

export type ClimatePeriodPreset = {
  id: ClimatePeriodPresetId;
  label: string;
  startYear: number;
  endYear: number | "current";
};

export type ClimateCacheEntry<T> = {
  createdAt: number;
  expiresAt: number;
  value: T;
};

export const REFERENCE_SOURCES: ReferenceSource[] = [
  {
    label: "Thornthwaite, 1948",
    description:
      "Referência metodológica da fórmula de evapotranspiração potencial usada no cálculo do balanço hídrico: Geographical Review, London, v.38, p.55-94.",
    href: "https://www.jstor.org/stable/210739?origin=crossref",
  },
  {
    label: "Open-Meteo Historical Weather API",
    description:
      "Fonte externa usada para séries históricas diárias de precipitação e temperatura. O GeoCalc usa o modelo ERA5 para manter consistência em séries históricas longas.",
    href: "https://open-meteo.com/en/docs/historical-weather-api",
  },
  {
    label: "OpenStreetMap",
    description: "Base cartográfica colaborativa usada na seleção visual do local.",
    href: "https://www.openstreetmap.org/copyright",
  },
  {
    label: "Leaflet",
    description: "Biblioteca de mapas interativos usada para renderizar o mapa.",
    href: "https://leafletjs.com/",
  },
  {
    label: "Nominatim",
    description:
      "Fonte externa usada para estimar o nome do local a partir das coordenadas selecionadas no mapa.",
    href: "https://nominatim.org/release-docs/latest/api/Reverse/",
  },
];

export const WATER_BALANCE_METHODOLOGY: MethodologySection[] = [
  {
    title: "O que é o balanço hídrico",
    body:
      "O Balanço Hídrico (BH) compara a água que entra e a água que sai de um espaço, como uma bacia hidrográfica, durante um período de tempo. Ele permite observar se houve sobra ou falta potencial de água no período analisado.",
  },
  {
    title: "Entrada e saída de água",
    body:
      "Na formulação usada aqui, a entrada é a precipitação mensal (P), medida em milímetros. A saída é a evapotranspiração potencial (Etp), que representa a demanda de perda de água para a atmosfera.",
  },
  {
    title: "Por que estimar a Etp",
    body:
      "Como muitas estações meteorológicas não medem a Etp diretamente em campo, o cálculo usa a fórmula de Thornthwaite para estimar a Etp mensal a partir da temperatura média mensal.",
  },
  {
    title: "Correção por latitude",
    body:
      "A equação de Thornthwaite foi proposta para condições padronizadas de Equador, mês de 30 dias e 12 horas de insolação diária. Por isso, a Etp é multiplicada por um fator de correção associado ao hemisfério, ao mês e à latitude de referência.",
  },
  {
    title: "Superávit e déficit",
    body:
      "Quando o resultado mensal é positivo, há superávit hídrico (SH). Quando é negativo, há déficit hídrico (DH), indicando que a demanda de evapotranspiração superou a entrada de água pela chuva.",
  },
  {
    title: "Vazão como aplicação futura",
    body:
      "O superávit hídrico anual também pode apoiar estimativas de vazão fluvial, tema importante em estudos de contaminação de águas. Esse desdobramento fica fora da calculadora atual e será tratado em etapa posterior.",
  },
];

export const WATER_BALANCE_FORMULAS = [
  "BH = P - Etp",
  "Etp mensal = 16 * (10t / I)^a",
  "i = (t / 5)^1,514",
  "I = soma(i)",
  "a = (675 * 10^-9 * I^3) - (771 * 10^-7 * I^2) + (0,01792 * I) + 0,49239",
  "Etp corrigida = Etp * FC",
  "BH = P - Etp corrigida",
];

export const CLIMATE_IMPORT_METHODOLOGY: MethodologySection[] = [
  {
    title: "Fonte climática",
    body:
      "Ao importar dados climáticos, o GeoCalc consulta a Open-Meteo usando o conjunto ERA5. Essa base reúne estimativas históricas consistentes de chuva e temperatura para longos períodos.",
  },
  {
    title: "De dias para meses",
    body:
      "A fonte climática trabalha dia a dia. Para chegar ao mês, o GeoCalc soma a chuva diária de cada mês e calcula a média das temperaturas médias diárias daquele mesmo mês.",
  },
  {
    title: "Média do período",
    body:
      "Depois, o sistema compara meses iguais ao longo dos anos escolhidos. Janeiro é comparado com janeiros, fevereiro com fevereiros, e assim por diante, formando uma média mensal do período de referência.",
  },
  {
    title: "Meses incompletos",
    body:
      "Quando o ano mais recente ainda não tem um mês completo disponível, esse mês não entra na média. Isso evita que poucos dias de chuva ou temperatura representem um mês inteiro.",
  },
];

export function getClimatePeriodPresets(): ClimatePeriodPreset[] {
  return [
    { id: "1940-1970", label: "1940-1970", startYear: 1940, endYear: 1970 },
    { id: "1971-2000", label: "1971-2000", startYear: 1971, endYear: 2000 },
    { id: "1991-2020", label: "1991-2020", startYear: 1991, endYear: 2020 },
    { id: "custom", label: "Personalizado", startYear: 1990, endYear: "current" },
  ];
}
