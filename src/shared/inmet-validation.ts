import {
  calculateWaterBalance,
  MONTHS,
  nearestFactorSelection,
  type FactorSelection,
  type MonthlyInput,
  type WaterBalanceResult,
} from "./water-balance";

export type InmetStation = {
  code: string;
  name: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  status: string;
};

export type InmetMonthlyRecord = {
  code: string;
  name: string;
  uf: string;
  monthly: Array<number | null>;
  annual: number | null;
};

export type InmetValidStation = {
  station: InmetStation;
  precipitation: InmetMonthlyRecord;
  temperature: InmetMonthlyRecord;
};

export type InmetExcludedStation = {
  code: string;
  name: string;
  uf: string;
  reason: string;
};

export type InmetStationAudit = {
  code: string;
  name: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  hasMetadata: boolean;
  hasValidCoordinates: boolean;
  hasPrecipitationRecord: boolean;
  hasTemperatureRecord: boolean;
  missingPrecipitationMonths: string[];
  missingTemperatureMonths: string[];
  reasons: string[];
  status: "valid" | "excluded";
};

export type InmetValidationDataset = {
  validStations: InmetValidStation[];
  excludedStations: InmetExcludedStation[];
  stationAudits: InmetStationAudit[];
  totals: {
    stations: number;
    precipitation: number;
    temperature: number;
    valid: number;
    excluded: number;
  };
};

export type SourceAnnualValues = {
  precipitationTotal: number | null;
  meanTemperature: number | null;
  correctedEtpTotal: number | null;
  balanceTotal: number | null;
  surplusTotal: number | null;
  deficitTotal: number | null;
};

export type SourceMonthlyValues = {
  precipitation: number | null;
  temperature: number | null;
  etp: number | null;
  correctedEtp: number | null;
  balance: number | null;
  surplus: number | null;
  deficit: number | null;
};

export type ValidationMetrics = {
  precipitationAnnualDiff: number | null;
  precipitationAnnualDiffPercent: number | null;
  meanTemperatureDiff: number | null;
  correctedEtpAnnualDiff: number | null;
  balanceAnnualDiff: number | null;
  precipitationMae: number | null;
  precipitationRmse: number | null;
  temperatureMae: number | null;
  temperatureRmse: number | null;
  balanceMae: number | null;
  balanceRmse: number | null;
  balanceClassDisagreements: number;
};

export type StationValidationComparison = {
  code: string;
  name: string;
  uf: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  status: string;
  factorSelection: FactorSelection;
  inmet: {
    inputs: MonthlyInput[];
    result: WaterBalanceResult;
    annual: SourceAnnualValues;
    monthly: SourceMonthlyValues[];
  };
  era5: {
    inputs: MonthlyInput[];
    result: WaterBalanceResult;
    annual: SourceAnnualValues;
    monthly: SourceMonthlyValues[];
  };
  metrics: ValidationMetrics;
};

export function buildInmetValidationDataset(params: {
  stations: InmetStation[];
  precipitationRecords: InmetMonthlyRecord[];
  temperatureRecords: InmetMonthlyRecord[];
}): InmetValidationDataset {
  const stationsByCode = new Map(
    params.stations.map((station) => [station.code, station]),
  );
  const precipitationByCode = new Map(
    params.precipitationRecords.map((record) => [record.code, record]),
  );
  const temperatureByCode = new Map(
    params.temperatureRecords.map((record) => [record.code, record]),
  );
  const candidateCodes = new Set([
    ...stationsByCode.keys(),
    ...precipitationByCode.keys(),
    ...temperatureByCode.keys(),
  ]);

  const validStations: InmetValidStation[] = [];
  const excludedStations: InmetExcludedStation[] = [];
  const stationAudits: InmetStationAudit[] = [];

  [...candidateCodes].sort().forEach((code) => {
    const station = stationsByCode.get(code);
    const precipitation = precipitationByCode.get(code);
    const temperature = temperatureByCode.get(code);
    const name =
      station?.name ?? precipitation?.name ?? temperature?.name ?? "Sem nome";
    const uf = station?.uf ?? precipitation?.uf ?? temperature?.uf ?? "";
    const audit = buildStationAudit(station, precipitation, temperature, {
      code,
      name,
      uf,
    });
    stationAudits.push(audit);

    if (audit.status === "excluded") {
      excludedStations.push({ code, name, uf, reason: audit.reasons[0] ?? "dado inválido" });
      return;
    }

    validStations.push({
      station: station as InmetStation,
      precipitation: precipitation as InmetMonthlyRecord,
      temperature: temperature as InmetMonthlyRecord,
    });
  });

  return {
    validStations,
    excludedStations,
    stationAudits,
    totals: {
      stations: params.stations.length,
      precipitation: params.precipitationRecords.length,
      temperature: params.temperatureRecords.length,
      valid: validStations.length,
      excluded: excludedStations.length,
    },
  };
}

export function buildStationAudit(
  station: InmetStation | undefined,
  precipitation: InmetMonthlyRecord | undefined,
  temperature: InmetMonthlyRecord | undefined,
  identity: { code: string; name: string; uf: string },
): InmetStationAudit {
  const missingPrecipitationMonths = missingMonthNames(precipitation);
  const missingTemperatureMonths = missingMonthNames(temperature);
  const reasons: string[] = [];
  const hasMetadata = Boolean(station);
  const hasValidCoordinates = Boolean(
    station && isNumber(station.latitude) && isNumber(station.longitude),
  );

  if (!hasMetadata) reasons.push("sem metadados da estação");
  if (hasMetadata && !hasValidCoordinates) reasons.push("sem coordenada válida");
  if (!precipitation) {
    reasons.push("sem registro de precipitação");
  } else if (missingPrecipitationMonths.length) {
    reasons.push("precipitação mensal incompleta");
  }
  if (!temperature) {
    reasons.push("sem registro de temperatura");
  } else if (missingTemperatureMonths.length) {
    reasons.push("temperatura mensal incompleta");
  }

  return {
    ...identity,
    latitude: station?.latitude ?? null,
    longitude: station?.longitude ?? null,
    altitude: station?.altitude ?? null,
    hasMetadata,
    hasValidCoordinates,
    hasPrecipitationRecord: Boolean(precipitation),
    hasTemperatureRecord: Boolean(temperature),
    missingPrecipitationMonths,
    missingTemperatureMonths,
    reasons,
    status: reasons.length ? "excluded" : "valid",
  };
}

export function geographicDistanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const earthRadiusKm = 6371.0088;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const latitude1 = toRadians(first.latitude);
  const latitude2 = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

export function compareStationWithEra5(
  inmetStation: InmetValidStation,
  era5Inputs: MonthlyInput[],
): StationValidationComparison {
  const { station } = inmetStation;
  if (station.latitude === null || station.longitude === null) {
    throw new Error(`Estação ${station.code} sem coordenadas válidas.`);
  }

  const factorSelection = nearestFactorSelection(station.latitude);
  const inmetInputs = toMonthlyInputs(
    inmetStation.precipitation.monthly,
    inmetStation.temperature.monthly,
  );
  const inmetResult = calculateWaterBalance(inmetInputs, factorSelection);
  const era5Result = calculateWaterBalance(era5Inputs, factorSelection);

  const inmetAnnual = buildAnnualValues(inmetInputs, inmetResult);
  const era5Annual = buildAnnualValues(era5Inputs, era5Result);
  const inmetMonthly = buildMonthlyValues(inmetResult);
  const era5Monthly = buildMonthlyValues(era5Result);

  return {
    code: station.code,
    name: station.name,
    uf: station.uf,
    latitude: station.latitude,
    longitude: station.longitude,
    altitude: station.altitude,
    status: station.status,
    factorSelection,
    inmet: {
      inputs: inmetInputs,
      result: inmetResult,
      annual: inmetAnnual,
      monthly: inmetMonthly,
    },
    era5: {
      inputs: era5Inputs,
      result: era5Result,
      annual: era5Annual,
      monthly: era5Monthly,
    },
    metrics: buildMetrics(inmetAnnual, era5Annual, inmetMonthly, era5Monthly),
  };
}

export function toMonthlyInputs(
  precipitation: Array<number | null>,
  temperature: Array<number | null>,
): MonthlyInput[] {
  return Array.from({ length: 12 }, (_, index) => ({
    precipitation: precipitation[index] ?? null,
    temperature: temperature[index] ?? null,
  }));
}

export function hasCompleteMonthlyValues(record?: InmetMonthlyRecord): boolean {
  if (!record) {
    return false;
  }

  return record.monthly.length === 12 && record.monthly.every(isNumber);
}

function missingMonthNames(record?: InmetMonthlyRecord): string[] {
  if (!record) return [];
  return MONTHS.flatMap((month, index) =>
    isNumber(record.monthly[index]) ? [] : [month.name],
  );
}

function buildAnnualValues(
  inputs: MonthlyInput[],
  result: WaterBalanceResult,
): SourceAnnualValues {
  const temperatures = inputs.map((input) => input.temperature).filter(isNumber);
  const balances = result.rows.map((row) => row.balance).filter(isNumber);

  return {
    precipitationTotal: result.annual.precipitationTotal,
    meanTemperature: temperatures.length === 12 ? average(temperatures) : null,
    correctedEtpTotal: result.annual.correctedEtpTotal,
    balanceTotal: result.annual.balanceTotal,
    surplusTotal:
      balances.length === 12
        ? sum(balances.map((value) => (value > 0 ? value : 0)))
        : null,
    deficitTotal:
      balances.length === 12
        ? sum(balances.map((value) => (value < 0 ? value : 0)))
        : null,
  };
}

function buildMonthlyValues(result: WaterBalanceResult): SourceMonthlyValues[] {
  return result.rows.map((row) => ({
    precipitation: row.precipitation,
    temperature: row.temperature,
    etp: row.etp,
    correctedEtp: row.correctedEtp,
    balance: row.balance,
    surplus: row.balance !== null && row.balance > 0 ? row.balance : null,
    deficit: row.balance !== null && row.balance < 0 ? row.balance : null,
  }));
}

function buildMetrics(
  inmetAnnual: SourceAnnualValues,
  era5Annual: SourceAnnualValues,
  inmetMonthly: SourceMonthlyValues[],
  era5Monthly: SourceMonthlyValues[],
): ValidationMetrics {
  const precipitationAnnualDiff = diff(
    era5Annual.precipitationTotal,
    inmetAnnual.precipitationTotal,
  );
  const balancePairs = buildPairs(inmetMonthly, era5Monthly, "balance");

  return {
    precipitationAnnualDiff,
    precipitationAnnualDiffPercent:
      precipitationAnnualDiff !== null &&
      inmetAnnual.precipitationTotal !== null &&
      inmetAnnual.precipitationTotal !== 0
        ? (precipitationAnnualDiff / Math.abs(inmetAnnual.precipitationTotal)) *
          100
        : null,
    meanTemperatureDiff: diff(
      era5Annual.meanTemperature,
      inmetAnnual.meanTemperature,
    ),
    correctedEtpAnnualDiff: diff(
      era5Annual.correctedEtpTotal,
      inmetAnnual.correctedEtpTotal,
    ),
    balanceAnnualDiff: diff(era5Annual.balanceTotal, inmetAnnual.balanceTotal),
    precipitationMae: mae(buildPairs(inmetMonthly, era5Monthly, "precipitation")),
    precipitationRmse: rmse(
      buildPairs(inmetMonthly, era5Monthly, "precipitation"),
    ),
    temperatureMae: mae(buildPairs(inmetMonthly, era5Monthly, "temperature")),
    temperatureRmse: rmse(buildPairs(inmetMonthly, era5Monthly, "temperature")),
    balanceMae: mae(balancePairs),
    balanceRmse: rmse(balancePairs),
    balanceClassDisagreements: balancePairs.filter(
      ([inmetBalance, era5Balance]) =>
        balanceClass(inmetBalance) !== balanceClass(era5Balance),
    ).length,
  };
}

function buildPairs(
  inmetMonthly: SourceMonthlyValues[],
  era5Monthly: SourceMonthlyValues[],
  key: keyof SourceMonthlyValues,
): Array<[number, number]> {
  return inmetMonthly.flatMap((inmetMonth, index) => {
    const inmetValue = inmetMonth[key];
    const era5Value = era5Monthly[index]?.[key] ?? null;
    return isNumber(inmetValue) && isNumber(era5Value)
      ? [[inmetValue, era5Value]]
      : [];
  });
}

function diff(value: number | null, reference: number | null): number | null {
  return isNumber(value) && isNumber(reference) ? value - reference : null;
}

function mae(pairs: Array<[number, number]>): number | null {
  return pairs.length
    ? average(pairs.map(([reference, value]) => Math.abs(value - reference)))
    : null;
}

function rmse(pairs: Array<[number, number]>): number | null {
  return pairs.length
    ? Math.sqrt(average(pairs.map(([reference, value]) => (value - reference) ** 2)))
    : null;
}

function balanceClass(value: number): "superávit" | "déficit" | "neutro" {
  if (value > 0) {
    return "superávit";
  }

  if (value < 0) {
    return "déficit";
  }

  return "neutro";
}

function average(values: number[]): number {
  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
