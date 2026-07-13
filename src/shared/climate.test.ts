import { describe, expect, test } from "bun:test";
import { aggregateDailyClimateToMonthlyNormals } from "./climate";

describe("climate aggregation", () => {
  test("aggregates daily data into monthly climatological normals", () => {
    const result = aggregateDailyClimateToMonthlyNormals({
      time: [
        "2020-01-01",
        "2020-01-02",
        "2021-01-01",
        "2021-01-02",
        "2020-02-01",
      ],
      temperature_2m_mean: [20, 22, 24, 26, 10],
      precipitation_sum: [1, 3, 5, 7, 9],
    });

    expect(result.monthly[0].temperature).toBeCloseTo(23, 10);
    expect(result.monthly[0].precipitation).toBeCloseTo(8, 10);
    expect(result.monthly[0].yearsWithData).toBe(2);
    expect(result.monthly[1].temperature).toBeCloseTo(10, 10);
    expect(result.monthly[1].precipitation).toBeCloseTo(9, 10);
  });

  test("reports months without complete data", () => {
    const result = aggregateDailyClimateToMonthlyNormals({
      time: ["2020-01-01"],
      temperature_2m_mean: [20],
      precipitation_sum: [null],
    });

    expect(result.missingMonths).toContain(1);
    expect(result.missingMonths).toContain(12);
  });

  test("ignores incomplete current-year months when complete months are required", () => {
    const result = aggregateDailyClimateToMonthlyNormals(
      {
        time: [
          "2026-01-01",
          "2026-01-02",
          "2026-01-03",
          "2026-02-01",
          "2026-02-02",
        ],
        temperature_2m_mean: [20, 22, 24, 30, 32],
        precipitation_sum: [1, 1, 1, 10, 10],
      },
      {
        requireCompleteMonths: true,
        effectiveEndDate: "2026-01-03",
      },
    );

    expect(result.monthly[0].temperature).toBeNull();
    expect(result.monthly[0].precipitation).toBeNull();
    expect(result.monthly[0].yearsWithData).toBe(0);
    expect(result.monthly[1].temperature).toBeNull();
  });

  test("keeps complete months in the climatological mean", () => {
    const january2025 = Array.from({ length: 31 }, (_, index) => ({
      date: `2025-01-${String(index + 1).padStart(2, "0")}`,
      temperature: 20,
      precipitation: 2,
    }));
    const january2026 = Array.from({ length: 31 }, (_, index) => ({
      date: `2026-01-${String(index + 1).padStart(2, "0")}`,
      temperature: 24,
      precipitation: 4,
    }));
    const days = [...january2025, ...january2026];

    const result = aggregateDailyClimateToMonthlyNormals(
      {
        time: days.map((day) => day.date),
        temperature_2m_mean: days.map((day) => day.temperature),
        precipitation_sum: days.map((day) => day.precipitation),
      },
      {
        requireCompleteMonths: true,
        effectiveEndDate: "2026-01-31",
      },
    );

    expect(result.monthly[0].temperature).toBeCloseTo(22, 10);
    expect(result.monthly[0].precipitation).toBeCloseTo(93, 10);
    expect(result.monthly[0].yearsWithData).toBe(2);
  });
});
