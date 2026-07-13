import { describe, expect, test } from "bun:test";
import { calculateWaterBalance, type MonthlyInput } from "$/water-balance";
import { createWaterBalanceWorkbook } from "./excel-export";

const spreadsheetInputs: MonthlyInput[] = [
  { precipitation: 111, temperature: 24.7 },
  { precipitation: 107, temperature: 24.6 },
  { precipitation: 94, temperature: 23.5 },
  { precipitation: 104, temperature: 20.2 },
  { precipitation: 102, temperature: 17 },
  { precipitation: 137, temperature: 14.5 },
  { precipitation: 121, temperature: 14.1 },
  { precipitation: 122, temperature: 15.4 },
  { precipitation: 135, temperature: 16.6 },
  { precipitation: 117, temperature: 19.2 },
  { precipitation: 93, temperature: 21.4 },
  { precipitation: 97, temperature: 23.3 },
];

describe("Excel export", () => {
  test("creates a detailed workbook with main and chart-data sheets", () => {
    const result = calculateWaterBalance(spreadsheetInputs, {
      hemisphere: "south",
      latitude: 30,
    });
    const workbook = createWaterBalanceWorkbook({
      result,
      location: {
        id: 1,
        name: "Niterói",
        admin1: "Rio de Janeiro",
        country: "Brasil",
        latitude: -22.8832,
        longitude: -43.1034,
        timezone: "America/Sao_Paulo",
      },
      point: { latitude: -22.8832, longitude: -43.1034 },
      startYear: 1990,
      endYear: 2026,
      effectiveEndDate: "2026-07-08",
      sourceState: "imported",
    });

    const mainSheet = workbook.getWorksheet("Balanço hídrico");
    const chartSheet = workbook.getWorksheet("Dados para gráfico");

    expect(mainSheet).toBeDefined();
    expect(chartSheet).toBeDefined();
    expect(mainSheet?.getCell("A1").value).toBe("PPG Geoquímica/UFF");
    expect(mainSheet?.getCell("A2").value).toBe("Ecocalc - Balanço hídrico");
    expect(mainSheet?.getCell("C4").value).toBe(
      "Niterói, Rio de Janeiro, Brasil",
    );
    expect(mainSheet?.getCell("C7").value).toBe("08/07/2026");
    expect(mainSheet?.getCell("A17").value).toBe("Mês");
    expect(mainSheet?.getCell("A18").value).toBe("Janeiro");
    expect(mainSheet?.getCell("B18").value).toBe(111);
    expect(mainSheet?.getCell("G18").value as number).toBeCloseTo(138.5, 1);
    expect(mainSheet?.getCell("A32").value).toBe("Legenda e interpretação");
    expect(mainSheet?.getCell("A33").value).toBe("P");
    expect(mainSheet?.getCell("B33").value).toContain("Precipitação mensal");

    expect(chartSheet?.getCell("A1").value).toBe("Mês");
    expect(chartSheet?.getCell("B1").value).toBe("P (mm)");
    expect(chartSheet?.getCell("A13").value).toBe("Dezembro");
  });
});
