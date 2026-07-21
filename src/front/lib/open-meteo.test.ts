import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import {
  buildClimateCacheKey,
  buildReverseGeocodingCacheKey,
  fetchClimateNormals,
  reverseGeocodePoint,
} from "./open-meteo";

const dailyPayload = {
  daily: {
    time: Array.from(
      { length: 31 },
      (_, index) => `2020-01-${String(index + 1).padStart(2, "0")}`,
    ),
    temperature_2m_mean: Array.from({ length: 31 }, () => 20),
    precipitation_sum: Array.from({ length: 31 }, () => 1),
  },
};

const params = {
  latitude: -22.88323,
  longitude: -43.10345,
  timezone: "America/Sao_Paulo",
  startYear: 2020,
  endYear: 2020,
  effectiveEndDate: "2020-01-31",
};

beforeEach(() => {
  setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: createSessionStorage(),
  });
});

afterEach(() => {
  setSystemTime();
  mock.restore();
});

describe("Open-Meteo adapter", () => {
  test("builds cache keys with rounded coordinates", () => {
    expect(buildClimateCacheKey(params)).toBe(
      "geocalc:climate-normal:-22.8832:-43.1035:America/Sao_Paulo:era5:2020:2020:2020-01-31",
    );
  });

  test("uses session cache for repeated climate imports", async () => {
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => dailyPayload,
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const first = await fetchClimateNormals(params);
    const second = await fetchClimateNormals(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("models=era5");
    expect(first.fromCache).toBeUndefined();
    expect(second.fromCache).toBe(true);
    expect(second.monthly[0].precipitation).toBe(31);
  });

  test("ignores expired climate cache entries", async () => {
    const key = buildClimateCacheKey(params);
    globalThis.sessionStorage.setItem(
      key,
      JSON.stringify({
        createdAt: Date.now() - 48 * 60 * 60 * 1000,
        expiresAt: Date.now() - 1,
        value: { monthly: [], inputs: [], missingMonths: [] },
      }),
    );
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => dailyPayload,
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    await fetchClimateNormals(params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(globalThis.sessionStorage.getItem(key)).toBeTruthy();
  });

  test("reverse geocodes map clicks and caches the location label", async () => {
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => ({
        address: {
          city: "Brasília",
          state: "Distrito Federal",
          country: "Brasil",
        },
      }),
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const point = { latitude: -15.7801, longitude: -47.9292 };
    const first = await reverseGeocodePoint(point);
    const second = await reverseGeocodePoint(point);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(buildReverseGeocodingCacheKey(point)).toBe(
      "geocalc:reverse-geocoding:-15.7801:-47.9292",
    );
    expect(first?.name).toBe("Brasília");
    expect(second?.name).toBe("Brasília");
  });
});

function createSessionStorage(): Storage {
  const data = new Map<string, string>();

  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
