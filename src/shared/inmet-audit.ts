import ExcelJS from "exceljs";
import type {
  InmetStationAudit,
  InmetValidationDataset,
} from "./inmet-validation";
import { geographicDistanceKm } from "./inmet-validation";

export type InmetAuditPeriodDataset = {
  period: "1961-1990" | "1981-2010" | "1991-2020";
  dataset: InmetValidationDataset;
};

export type CoordinateComparisonRow = {
  code: string;
  name: string;
  uf: string;
  latitude1961: number | null;
  longitude1961: number | null;
  latitude1981: number | null;
  longitude1981: number | null;
  distanceTo1981Km: number | null;
  status1981: string;
  latitude1991: number | null;
  longitude1991: number | null;
  distanceTo1991Km: number | null;
  status1991: string;
};

const COLORS = {
  dark: "1A3B29",
  green: "009B6E",
  lightGreen: "E7F6EF",
  muted: "54595F",
  border: "B9C8BF",
};

export function buildCoordinateComparisonRows(
  periods: InmetAuditPeriodDataset[],
): CoordinateComparisonRow[] {
  const auditsByPeriod = new Map(
    periods.map(({ period, dataset }) => [
      period,
      new Map(dataset.stationAudits.map((audit) => [audit.code, audit])),
    ]),
  );
  const baseAudits = auditsByPeriod.get("1961-1990") ?? new Map<string, InmetStationAudit>();

  return [...baseAudits.values()]
    .map((base) => {
      const from1981 = auditsByPeriod.get("1981-2010")?.get(base.code);
      const from1991 = auditsByPeriod.get("1991-2020")?.get(base.code);
      return {
        code: base.code,
        name: base.name,
        uf: base.uf,
        latitude1961: base.latitude,
        longitude1961: base.longitude,
        latitude1981: from1981?.latitude ?? null,
        longitude1981: from1981?.longitude ?? null,
        distanceTo1981Km: distanceBetweenAudits(base, from1981),
        status1981: coordinateReferenceStatus(from1981),
        latitude1991: from1991?.latitude ?? null,
        longitude1991: from1991?.longitude ?? null,
        distanceTo1991Km: distanceBetweenAudits(base, from1991),
        status1991: coordinateReferenceStatus(from1991),
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));
}

export function buildInmetAuditWorkbook(
  periods: InmetAuditPeriodDataset[],
  generatedAt = new Date(),
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GeoCalc";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;
  workbook.title = "GeoCalc - Auditoria das Normais INMET";

  buildSummarySheet(workbook, periods, generatedAt);
  buildStationsSheet(workbook, periods);
  buildIncompleteStationsSheet(workbook, periods);
  buildCoordinatesSheet(workbook, buildCoordinateComparisonRows(periods));
  buildMethodologySheet(workbook);
  return workbook;
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  periods: InmetAuditPeriodDataset[],
  generatedAt: Date,
) {
  const sheet = workbook.addWorksheet("Resumo");
  sheet.columns = widths([20, 18, 18, 18, 18, 56]);
  title(sheet, "GeoCalc - Auditoria das Normais Climatológicas INMET", 1, 6);
  header(sheet, 3, ["Normal", "Estações", "Válidas", "Excluídas", "Completude", "Observação"]);
  periods.forEach(({ period, dataset }, index) => {
    const row = sheet.getRow(index + 4);
    row.values = [
      period,
      dataset.stationAudits.length,
      dataset.validStations.length,
      dataset.excludedStations.length,
      dataset.stationAudits.length
        ? dataset.validStations.length / dataset.stationAudits.length
        : null,
      "Válida: 12 meses de precipitação e temperatura, com coordenadas geográficas válidas.",
    ];
  });
  numberColumns(sheet, 4, 3 + periods.length, [2, 3, 4]);
  percentageColumn(sheet, 4, 3 + periods.length, 5);
  table(sheet, 3, 3 + periods.length, 1, 6);

  const reasonRows = periods.flatMap(({ period, dataset }) =>
    countReasons(dataset.stationAudits).map(([reason, count]) => [period, reason, count]),
  );
  const sectionRow = 6 + periods.length;
  section(sheet, "Distribuição dos motivos de exclusão", sectionRow, 3);
  header(sheet, sectionRow + 1, ["Normal", "Motivo", "Estações"]);
  reasonRows.forEach((row, index) => {
    sheet.getRow(sectionRow + 2 + index).values = row;
  });
  table(sheet, sectionRow + 1, Math.max(sectionRow + 1, sectionRow + 1 + reasonRows.length), 1, 3);
  numberColumns(sheet, sectionRow + 2, sectionRow + 1 + reasonRows.length, [3]);

  const generatedRow = sectionRow + 4 + reasonRows.length;
  sheet.getCell(generatedRow, 1).value = "Data de geração";
  sheet.getCell(generatedRow, 2).value = formatDate(generatedAt);
}

function buildStationsSheet(workbook: ExcelJS.Workbook, periods: InmetAuditPeriodDataset[]) {
  const sheet = workbook.addWorksheet("Estações por período", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([16, 14, 30, 8, 14, 14, 12, 14, 14, 14, 16, 16, 52]);
  header(sheet, 1, [
    "Normal",
    "Código",
    "Estação",
    "UF",
    "Latitude",
    "Longitude",
    "Altitude",
    "Metadados",
    "Coordenadas",
    "Precipitação",
    "Temperatura",
    "Status final",
    "Motivos",
  ]);
  let rowNumber = 2;
  periods.forEach(({ period, dataset }) => {
    dataset.stationAudits.forEach((audit) => {
      sheet.getRow(rowNumber).values = [
        period,
        audit.code,
        audit.name,
        audit.uf,
        audit.latitude,
        audit.longitude,
        audit.altitude,
        audit.hasMetadata ? "Sim" : "Não",
        audit.hasValidCoordinates ? "Válidas" : "Inválidas/ausentes",
        recordStatus(audit.hasPrecipitationRecord, audit.missingPrecipitationMonths),
        recordStatus(audit.hasTemperatureRecord, audit.missingTemperatureMonths),
        audit.status === "valid" ? "Válida" : "Excluída",
        audit.reasons.join("; "),
      ];
      rowNumber += 1;
    });
  });
  table(sheet, 1, rowNumber - 1, 1, 13);
  numberColumns(sheet, 2, rowNumber - 1, [5, 6, 7]);
  sheet.autoFilter = { from: "A1", to: `M${rowNumber - 1}` };
}

function buildIncompleteStationsSheet(workbook: ExcelJS.Workbook, periods: InmetAuditPeriodDataset[]) {
  const sheet = workbook.addWorksheet("Estações incompletas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([16, 14, 30, 8, 14, 14, 48, 36, 36]);
  header(sheet, 1, [
    "Normal",
    "Código",
    "Estação",
    "UF",
    "Latitude",
    "Longitude",
    "Motivos da exclusão",
    "Meses ausentes de P",
    "Meses ausentes de T",
  ]);
  let rowNumber = 2;
  periods.forEach(({ period, dataset }) => {
    dataset.stationAudits
      .filter((audit) => audit.status === "excluded")
      .forEach((audit) => {
        sheet.getRow(rowNumber).values = [
          period,
          audit.code,
          audit.name,
          audit.uf,
          audit.latitude,
          audit.longitude,
          audit.reasons.join("; "),
          audit.missingPrecipitationMonths.join(", "),
          audit.missingTemperatureMonths.join(", "),
        ];
        rowNumber += 1;
      });
  });
  table(sheet, 1, Math.max(1, rowNumber - 1), 1, 9);
  numberColumns(sheet, 2, rowNumber - 1, [5, 6]);
  sheet.autoFilter = { from: "A1", to: `I${Math.max(1, rowNumber - 1)}` };
}

function buildCoordinatesSheet(workbook: ExcelJS.Workbook, rows: CoordinateComparisonRow[]) {
  const sheet = workbook.addWorksheet("Coordenadas 1961-1990", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = widths([14, 30, 8, 14, 14, 14, 14, 18, 30, 14, 14, 14, 14, 18, 30]);
  header(sheet, 1, [
    "Código",
    "Estação",
    "UF",
    "Lat. 1961-1990",
    "Long. 1961-1990",
    "Lat. 1981-2010",
    "Long. 1981-2010",
    "Distância 1961-1981 (km)",
    "Referência 1981-2010",
    "Lat. 1991-2020",
    "Long. 1991-2020",
    "Distância 1961-1991 (km)",
    "Referência 1991-2020",
  ]);
  rows.forEach((row, index) => {
    sheet.getRow(index + 2).values = [
      row.code,
      row.name,
      row.uf,
      row.latitude1961,
      row.longitude1961,
      row.latitude1981,
      row.longitude1981,
      row.distanceTo1981Km,
      row.status1981,
      row.latitude1991,
      row.longitude1991,
      row.distanceTo1991Km,
      row.status1991,
    ];
  });
  table(sheet, 1, Math.max(1, rows.length + 1), 1, 13);
  numberColumns(sheet, 2, rows.length + 1, [4, 5, 6, 7, 8, 10, 11, 12]);
  sheet.autoFilter = { from: "A1", to: `M${Math.max(1, rows.length + 1)}` };
}

function buildMethodologySheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("Metodologia");
  sheet.columns = widths([34, 112]);
  title(sheet, "Metodologia da auditoria INMET", 1, 2);
  const values = [
    ["Objetivo", "Inventariar as estações fornecidas para cada normal climatológica, documentar a completude dos dados e registrar diferenças de coordenadas da normal 1961-1990 em relação às normais posteriores."],
    ["Critério de inclusão", "Uma estação é considerada válida quando possui metadados, coordenadas geográficas válidas, 12 meses de precipitação e 12 meses de temperatura."],
    ["Dados incompletos", "Estações sem um desses requisitos são registradas como excluídas, com os motivos e os meses ausentes de precipitação (P) e temperatura (T). Elas não são exibidas na seleção pública do GeoCalc."],
    ["Coordenadas", "As coordenadas em graus, minutos e segundos da normal 1961-1990 são convertidas para graus decimais. A auditoria mantém os valores fornecidos; não altera nem corrige coordenadas."],
    ["Distâncias", "Para códigos presentes na normal 1961-1990 e em cada normal posterior, a distância geográfica é calculada pela fórmula de Haversine, em quilômetros. A ausência de referência ou coordenada é registrada sem impor limiar de erro."],
  ];
  values.forEach((row, index) => {
    sheet.getRow(index + 3).values = row;
  });
  table(sheet, 3, values.length + 2, 1, 2);
}

function distanceBetweenAudits(
  first: InmetStationAudit,
  second: InmetStationAudit | undefined,
): number | null {
  if (!hasCoordinates(first) || !second || !hasCoordinates(second)) {
    return null;
  }
  return geographicDistanceKm(first, second);
}

function hasCoordinates(
  audit: InmetStationAudit,
): audit is InmetStationAudit & { latitude: number; longitude: number } {
  return audit.latitude !== null && audit.longitude !== null;
}

function coordinateReferenceStatus(audit: InmetStationAudit | undefined): string {
  if (!audit) return "Código não disponível neste período";
  return audit.hasValidCoordinates ? "Disponível" : "Coordenada inválida ou ausente";
}

function recordStatus(hasRecord: boolean, missingMonths: string[]): string {
  if (!hasRecord) return "Ausente";
  return missingMonths.length ? `Incompleta (${missingMonths.length}/12 ausente(s))` : "Completa";
}

function countReasons(audits: InmetStationAudit[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  audits.forEach((audit) => {
    audit.reasons.forEach((reason) => counts.set(reason, (counts.get(reason) ?? 0) + 1));
  });
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, "pt-BR"));
}

function title(sheet: ExcelJS.Worksheet, value: string, row: number, lastColumn: number) {
  sheet.mergeCells(row, 1, row, lastColumn);
  const cell = sheet.getCell(row, 1);
  cell.value = value;
  cell.style = {
    font: { bold: true, size: 16, color: { argb: "FFFFFFFF" }, name: "Roboto Slab" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.dark } },
    alignment: { vertical: "middle", horizontal: "center" },
  };
  sheet.getRow(row).height = 30;
}

function section(sheet: ExcelJS.Worksheet, value: string, row: number, lastColumn: number) {
  sheet.mergeCells(row, 1, row, lastColumn);
  const cell = sheet.getCell(row, 1);
  cell.value = value;
  cell.style = {
    font: { bold: true, color: { argb: COLORS.dark }, name: "Roboto Slab" },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lightGreen } },
    alignment: { vertical: "middle", horizontal: "left" },
    border: fullBorder(),
  };
}

function header(sheet: ExcelJS.Worksheet, row: number, values: string[]) {
  const current = sheet.getRow(row);
  current.values = values;
  current.height = 28;
  current.eachCell((cell) => {
    cell.style = {
      font: { bold: true, color: { argb: "FFFFFFFF" }, name: "Roboto" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.green } },
      alignment: { vertical: "middle", horizontal: "center", wrapText: true },
      border: fullBorder(),
    };
  });
}

function table(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, startColumn: number, endColumn: number) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.getCell(row, column);
      cell.border = cell.border ?? fullBorder();
      cell.alignment = cell.alignment ?? {
        vertical: "middle",
        horizontal: column === startColumn ? "left" : "right",
        wrapText: true,
      };
      cell.font = cell.font ?? { color: { argb: COLORS.muted }, name: "Roboto" };
    }
  }
}

function numberColumns(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, columns: number[]) {
  for (let row = startRow; row <= endRow; row += 1) {
    columns.forEach((column) => {
      const cell = sheet.getCell(row, column);
      if (typeof cell.value === "number") cell.numFmt = "0.0000";
    });
  }
}

function percentageColumn(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, column: number) {
  for (let row = startRow; row <= endRow; row += 1) {
    sheet.getCell(row, column).numFmt = "0.0%";
  }
}

function widths(values: number[]) {
  return values.map((width) => ({ width }));
}

function fullBorder(): Partial<ExcelJS.Borders> {
  return {
    top: { style: "thin", color: { argb: COLORS.border } },
    left: { style: "thin", color: { argb: COLORS.border } },
    bottom: { style: "thin", color: { argb: COLORS.border } },
    right: { style: "thin", color: { argb: COLORS.border } },
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
