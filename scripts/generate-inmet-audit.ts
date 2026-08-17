import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildInmetAuditWorkbook,
  type InmetAuditPeriodDataset,
} from "../src/shared/inmet-audit";
import {
  INMET_NORMAL_PERIODS,
  readPeriodDataset,
  type InmetNormalPeriod,
} from "./generate-inmet-normals-data";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "docs/gerados");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "auditoria-inmet-normais.xlsx");
const PERIODS: InmetNormalPeriod[] = ["1961-1990", "1981-2010", "1991-2020"];

async function main() {
  const periods: InmetAuditPeriodDataset[] = PERIODS.map((period) => ({
    period,
    dataset: readPeriodDataset(INMET_NORMAL_PERIODS[period]),
  }));
  const workbook = buildInmetAuditWorkbook(periods);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await workbook.xlsx.writeFile(OUTPUT_FILE);

  periods.forEach(({ period, dataset }) => {
    console.log(`${period}: ${dataset.validStations.length} válidas, ${dataset.excludedStations.length} excluídas.`);
  });
  console.log(`Auditoria gerada em ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
