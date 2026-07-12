import {
  aggregateDailyClimateToMonthlyNormals,
  type ClimateAggregationResult,
  type DailyClimateSeries,
} from "$/climate";

export type LocationSearchResult = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

type GeocodingResponse = {
  results?: Array<{
    id: number;
    name: string;
    country?: string;
    admin1?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }>;
};

type ArchiveResponse = {
  daily: DailyClimateSeries;
};

export async function searchLocations(
  query: string,
): Promise<LocationSearchResult[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    name: trimmedQuery,
    count: "6",
    language: "pt",
    format: "json",
  });
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Nao foi possivel buscar locais.");
  }

  const payload = (await response.json()) as GeocodingResponse;
  return (payload.results ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    country: item.country ?? "",
    admin1: item.admin1,
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone ?? "auto",
  }));
}

export async function fetchClimateNormals(params: {
  latitude: number;
  longitude: number;
  timezone: string;
  startYear: number;
  endYear: number;
}): Promise<ClimateAggregationResult> {
  const query = new URLSearchParams({
    latitude: params.latitude.toString(),
    longitude: params.longitude.toString(),
    start_date: `${params.startYear}-01-01`,
    end_date: `${params.endYear}-12-31`,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: params.timezone || "auto",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  const response = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Nao foi possivel importar a serie climatica.");
  }

  const payload = (await response.json()) as ArchiveResponse;
  return aggregateDailyClimateToMonthlyNormals(payload.daily);
}
