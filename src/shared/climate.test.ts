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
});
