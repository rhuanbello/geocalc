import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";

GlobalRegistrator.register();

mock.module("@/components/MapPicker", () => ({
  MapPicker: () => <div data-testid="map-picker" />,
}));

mock.module("@/lib/open-meteo", () => ({
  fetchClimateNormals: mock(),
  searchLocations: mock(async () => [
    {
      id: 1,
      name: "Niterói",
      admin1: "Rio de Janeiro",
      country: "Brasil",
      latitude: -22.8832,
      longitude: -43.1034,
      timezone: "America/Sao_Paulo",
    },
  ]),
}));

mock.module("recharts", () => {
  const passthrough =
    (name: string) =>
    ({ children }: { children?: ReactNode }) =>
      <div data-testid={`recharts-${name}`}>{children}</div>;

  return {
    Bar: passthrough("bar"),
    CartesianGrid: passthrough("cartesian-grid"),
    ComposedChart: passthrough("composed-chart"),
    Line: passthrough("line"),
    ResponsiveContainer: passthrough("responsive-container"),
    Tooltip: passthrough("tooltip"),
    XAxis: passthrough("x-axis"),
    YAxis: passthrough("y-axis"),
  };
});

const { cleanup, fireEvent, render, screen, waitFor, within } = await import(
  "@testing-library/react"
);
const userEvent = (await import("@testing-library/user-event")).default;
const { App } = await import("./App");

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

afterEach(() => {
  cleanup();
});

describe("App spreadsheet parity", () => {
  test("busca local pelo combobox e seleciona resultado", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("combobox", { name: "Buscar local" }));
    await user.type(screen.getByPlaceholderText("Ex.: Niterói, RJ"), "niteroi");

    await waitFor(() => {
      expect(screen.getByText("Niterói")).toBeTruthy();
    });

    await user.click(screen.getByText("Niterói"));

    expect(screen.getAllByText(/-22,8832/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Preencher com dados climáticos/i })).toBeTruthy();
  });

  test("mantem estados decimais intermediarios nos campos de entrada", () => {
    render(<App />);

    const januaryTemperature = screen.getByLabelText(
      "Temperatura de Janeiro",
    ) as HTMLInputElement;
    const januaryPrecipitation = screen.getByLabelText(
      "Precipitação de Janeiro",
    ) as HTMLInputElement;

    fireEvent.change(januaryTemperature, { target: { value: "24," } });
    expect(januaryTemperature.value).toBe("24,");

    fireEvent.change(januaryTemperature, { target: { value: "24." } });
    expect(januaryTemperature.value).toBe("24.");

    fireEvent.change(januaryPrecipitation, { target: { value: "" } });
    expect(januaryPrecipitation.value).toBe("");
  });

  test("preenche os valores da planilha e exibe os resultados arredondados esperados", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.selectOptions(screen.getByLabelText("Hemisfério"), "south");
    await user.selectOptions(screen.getByLabelText("Latitude de fator"), "30");

    for (const row of spreadsheetRows) {
      fireEvent.change(screen.getByLabelText(`Precipitação de ${row.month}`), {
        target: { value: row.precipitation },
      });
      fireEvent.change(screen.getByLabelText(`Temperatura de ${row.month}`), {
        target: { value: row.temperature },
      });
    }

    expect(metricText(container, "P anual")).toBe("1.340,0 mm");
    expect(metricText(container, "ETP corr.")).toBe("941,9 mm");
    expect(metricText(container, "BH anual")).toBe("398,1 mm");

    expect(rowText(container, "Janeiro")).toContain("1,19");
    expect(rowText(container, "Janeiro")).toContain("11,23");
    expect(rowText(container, "Janeiro")).toContain("116,4");
    expect(rowText(container, "Janeiro")).toContain("138,5");
    expect(rowText(container, "Janeiro")).toContain("-27,5");

    expect(rowText(container, "Junho")).toContain("0,84");
    expect(rowText(container, "Junho")).toContain("5,01");
    expect(rowText(container, "Junho")).toContain("38,1");
    expect(rowText(container, "Junho")).toContain("32,0");
    expect(rowText(container, "Junho")).toContain("105,0");

    const report = screen.getByDisplayValue(
      /Relatório didático/,
    ) as HTMLTextAreaElement;
    expect(report.value).toContain("Precipitação total: 1.340,0 mm");
    expect(report.value).toContain("Data final efetiva da importação: 08/07/2026");
    expect(report.value).toContain(
      "Base técnica: cálculos fornecidos por Edison Dausacker Bidone.",
    );
    expect(report.value).toContain("ETP corrigida total: 941,9 mm");
    expect(report.value).toContain("Balanço hídrico anual: 398,1 mm");
    expect(report.value).toContain("Índice calorimétrico anual I: 95,902");
    expect(report.value).toContain("Expoente a: 2,097");
    expect(report.value).toContain("Maior déficit: Janeiro (-27,5 mm)");
    expect(report.value).toContain("Maior superávit: Junho (105,0 mm)");
    expect(screen.getByText("Entenda as variáveis")).toBeTruthy();
    expect(screen.queryByText("Preenchimento manual")).toBeNull();
  });

  test("exibe a ação de exportar Excel", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /Exportar Excel/i })).toBeTruthy();
  });
});

function metricText(container: HTMLElement, label: string): string {
  const cards = Array.from(container.querySelectorAll(".metric-card"));
  const card = cards.find((item) => item.textContent?.includes(label));

  if (!card) {
    throw new Error(`Metric not found: ${label}`);
  }

  return within(card as HTMLElement).getByText(/mm|-$/).textContent ?? "";
}

function rowText(container: HTMLElement, month: string): string {
  const rows = Array.from(container.querySelectorAll("tbody tr"));
  const row = rows.find((item) => item.textContent?.includes(month));

  if (!row) {
    throw new Error(`Row not found: ${month}`);
  }

  return row.textContent ?? "";
}
