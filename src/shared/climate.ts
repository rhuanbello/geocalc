import { MONTHS, type MonthlyInput } from "./water-balance";

export type DailyClimateSeries = {
  time: string[];
  temperature_2m_mean: Array<number | null>;
  precipitation_sum: Array<number | null>;
};

export type MonthlyClimateNormal = {
  month: number;
  monthName: string;
  precipitation: number | null;
  temperature: number | null;
  yearsWithData: number;
};

export type ClimateAggregationResult = {
  monthly: MonthlyClimateNormal[];
  inputs: MonthlyInput[];
  missingMonths: number[];
};

type MonthYearAccumulator = {
  temperatureTotal: number;
  temperatureDays: number;
  precipitationTotal: number;
  precipitationDays: number;
};

export function aggregateDailyClimateToMonthlyNormals(
  daily: DailyClimateSeries,
): ClimateAggregationResult {
  const byYearMonth = new Map<string, MonthYearAccumulator>();

  daily.time.forEach((date, index) => {
    const [year, month] = date.split("-");
    if (!year || !month) {
      return;
    }

    const key = `${year}-${month}`;
    const accumulator =
      byYearMonth.get(key) ??
      {
        temperatureTotal: 0,
        temperatureDays: 0,
        precipitationTotal: 0,
        precipitationDays: 0,
      };
    const temperature = daily.temperature_2m_mean[index];
    const precipitation = daily.precipitation_sum[index];

    if (typeof temperature === "number" && Number.isFinite(temperature)) {
      accumulator.temperatureTotal += temperature;
      accumulator.temperatureDays += 1;
    }

    if (typeof precipitation === "number" && Number.isFinite(precipitation)) {
      accumulator.precipitationTotal += precipitation;
      accumulator.precipitationDays += 1;
    }

    byYearMonth.set(key, accumulator);
  });

  const monthly = MONTHS.map((monthInfo) => {
    const monthKey = monthInfo.month.toString().padStart(2, "0");
    const yearMonthValues = [...byYearMonth.entries()].filter(([key]) =>
      key.endsWith(`-${monthKey}`),
    );
    const validYearMonthValues = yearMonthValues
      .map(([, value]) => {
        if (value.temperatureDays === 0 || value.precipitationDays === 0) {
          return null;
        }

        return {
          temperature: value.temperatureTotal / value.temperatureDays,
          precipitation: value.precipitationTotal,
        };
      })
      .filter((value): value is { temperature: number; precipitation: number } =>
        Boolean(value),
      );

    if (!validYearMonthValues.length) {
      return {
        month: monthInfo.month,
        monthName: monthInfo.name,
        precipitation: null,
        temperature: null,
        yearsWithData: 0,
      };
    }

    return {
      month: monthInfo.month,
      monthName: monthInfo.name,
      precipitation: average(validYearMonthValues.map((value) => value.precipitation)),
      temperature: average(validYearMonthValues.map((value) => value.temperature)),
      yearsWithData: validYearMonthValues.length,
    };
  });

  return {
    monthly,
    inputs: monthly.map((month) => ({
      precipitation: month.precipitation,
      temperature: month.temperature,
    })),
    missingMonths: monthly
      .filter((month) => month.precipitation === null || month.temperature === null)
      .map((month) => month.month),
  };
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
