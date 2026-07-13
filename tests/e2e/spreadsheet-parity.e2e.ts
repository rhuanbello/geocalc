import { expect, test } from "@playwright/test";

const spreadsheetRows = [
  { month: "Janeiro", precipitation: "111", temperature: "24,7" },
  { month: "Fevereiro", precipitation: "107", temperature: "24.6" },
  { month: "Março", precipitation: "94", temperature: "23.5" },
  { month: "Abril", precipitation: "104", temperature: "20.2" },
  { month: "Maio", precipitation: "102", temperature: "17" },
  { month: "Junho", precipitation: "137", temperature: "14.5" },
  { month: "Julho", precipitation: "121", temperature: "14.1" },
  { month: "Agosto", precipitation: "122", temperature: "15.4" },
  { month: "Setembro", precipitation: "135", temperature: "16.6" },
  { month: "Outubro", precipitation: "117", temperature: "19.2" },
  { month: "Novembro", precipitation: "93", temperature: "21.4" },
  { month: "Dezembro", precipitation: "97", temperature: "23.3" },
];

test("preenche os valores da planilha e reproduz os resultados arredondados na UI", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Ecocalc")).toBeVisible();
  await expect(page.getByRole("link", { name: /Balanço Hídrico/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Preencher com dados climáticos/i }),
  ).toBeVisible();

  await page.getByLabel("Hemisfério").selectOption("south");
  await page.getByLabel("Latitude de fator").selectOption("30");

  await page.getByLabel("Temperatura de Janeiro").fill("24,");
  await expect(page.getByLabel("Temperatura de Janeiro")).toHaveValue("24,");
  await page.getByLabel("Temperatura de Janeiro").fill("24.");
  await expect(page.getByLabel("Temperatura de Janeiro")).toHaveValue("24.");

  for (const row of spreadsheetRows) {
    await page
      .getByLabel(`Precipitação de ${row.month}`)
      .fill(row.precipitation);
    await page.getByLabel(`Temperatura de ${row.month}`).fill(row.temperature);
  }

  await expect(metricValue(page, "P anual")).toHaveText("1.340,0 mm");
  await expect(metricValue(page, "ETP corr.")).toHaveText("941,9 mm");
  await expect(metricValue(page, "BH anual")).toHaveText("398,1 mm");

  await expect(tableRow(page, "Janeiro")).toContainText([
    "Janeiro",
    "1,19",
    "11,23",
    "116,4",
    "138,5",
    "-27,5",
  ]);
  await expect(tableRow(page, "Junho")).toContainText([
    "Junho",
    "0,84",
    "5,01",
    "38,1",
    "32,0",
    "105,0",
  ]);
  await expect(tableRow(page, "Dezembro")).toContainText([
    "Dezembro",
    "1,20",
    "10,28",
    "103,0",
    "123,5",
    "-26,5",
  ]);

  const report = page.locator(".report-panel textarea");
  await expect(report).toContainText("Precipitação total: 1.340,0 mm");
  await expect(report).toContainText("ETP corrigida total: 941,9 mm");
  await expect(report).toContainText("Balanço hídrico anual: 398,1 mm");
  await expect(report).toContainText("Índice calorimétrico anual I: 95,902");
  await expect(report).toContainText("Expoente a: 2,097");
  await expect(report).toContainText("Maior déficit: Janeiro (-27,5 mm)");
  await expect(report).toContainText("Maior superávit: Junho (105,0 mm)");
  await expect(page.getByRole("button", { name: /Exportar Excel/i })).toBeVisible();
});

function metricValue(page: import("@playwright/test").Page, label: string) {
  return page.locator(".metric-card").filter({ hasText: label }).locator("strong");
}

function tableRow(page: import("@playwright/test").Page, month: string) {
  return page.locator("tbody tr").filter({ hasText: month });
}
