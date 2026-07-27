import inmetNormals19912020 from "./data/inmet-normals-1991-2020.json";
import type { MonthlyInput } from "./water-balance";

export type ClimateDataSource = "open-meteo" | "inmet";

export type InmetNormalPeriod = "1991-2020";

export type InmetNormalStation = {
  code: string;
  name: string;
  uf: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  status: string;
  precipitation: number[];
  temperature: number[];
};

export type InmetNormalsDataset = {
  source: string;
  period: InmetNormalPeriod;
  generatedAt: string;
  stationCount: number;
  stations: InmetNormalStation[];
};

const dataset = inmetNormals19912020 as InmetNormalsDataset;

export function getInmetNormalsDataset(): InmetNormalsDataset {
  return dataset;
}

export function listInmetStations(): InmetNormalStation[] {
  return dataset.stations;
}

export function getInmetStationByCode(
  code: string | null,
): InmetNormalStation | null {
  if (!code) {
    return null;
  }

  return dataset.stations.find((station) => station.code === code) ?? null;
}

export function searchInmetStations(query: string): InmetNormalStation[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return dataset.stations.slice(0, 24);
  }

  return dataset.stations
    .filter((station) =>
      [
        station.code,
        station.name,
        station.uf,
        `${station.name} ${station.uf}`,
      ].some((value) => normalizeSearchText(value).includes(normalizedQuery)),
    )
    .slice(0, 40);
}

export function inmetStationToMonthlyInputs(
  station: InmetNormalStation,
): MonthlyInput[] {
  return Array.from({ length: 12 }, (_, index) => ({
    precipitation: station.precipitation[index] ?? null,
    temperature: station.temperature[index] ?? null,
  }));
}

export function inmetStationLabel(station: InmetNormalStation): string {
  return `${station.code} - ${station.name}, ${station.uf}`;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
