import { describe, expect, test } from "bun:test";
import {
  buildCoordinateComparisonRows,
  buildInmetAuditWorkbook,
  type InmetAuditPeriodDataset,
} from "./inmet-audit";
import {
  buildInmetValidationDataset,
  type InmetMonthlyRecord,
  type InmetStation,
} from "./inmet-validation";

const monthly = Array.from({ length: 12 }, (_, index) => index + 1);

describe("INMET audit workbook", () => {
  test("reports incomplete data and coordinate differences across normal periods", () => {
    const periods = buildPeriods();
    const rows = buildCoordinateComparisonRows(periods);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        code: "1",
        distanceTo1981Km: expect.any(Number),
        status1991: "Código não disponível neste período",
      }),
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({
        code: "2",
        status1981: "Código não disponível neste período",
        status1991: "Código não disponível neste período",
      }),
    );

    const workbook = buildInmetAuditWorkbook(periods, new Date("2026-08-17T00:00:00.000Z"));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Resumo",
      "Estações por período",
      "Estações incompletas",
      "Coordenadas 1961-1990",
      "Metodologia",
    ]);
    expect(workbook.getWorksheet("Estações incompletas")?.rowCount).toBeGreaterThan(1);
    expect(workbook.getWorksheet("Coordenadas 1961-1990")?.rowCount).toBe(3);
  });
});

function buildPeriods(): InmetAuditPeriodDataset[] {
  const base = buildInmetValidationDataset({
    stations: [station("1", -10, -40), station("2", -12, -42)],
    precipitationRecords: [record("1", monthly), record("2", [1, null, ...monthly.slice(2)])],
    temperatureRecords: [record("1", monthly), record("2", monthly)],
  });
  const later = buildInmetValidationDataset({
    stations: [station("1", -10, -41)],
    precipitationRecords: [record("1", monthly)],
    temperatureRecords: [record("1", monthly)],
  });

  return [
    { period: "1961-1990", dataset: base },
    { period: "1981-2010", dataset: later },
    {
      period: "1991-2020",
      dataset: buildInmetValidationDataset({ stations: [], precipitationRecords: [], temperatureRecords: [] }),
    },
  ];
}

function station(code: string, latitude: number, longitude: number): InmetStation {
  return { code, name: `Estação ${code}`, uf: "DF", latitude, longitude, altitude: 1000, status: "Operante" };
}

function record(code: string, values: Array<number | null>): InmetMonthlyRecord {
  return { code, name: `Estação ${code}`, uf: "DF", monthly: values, annual: null };
}
