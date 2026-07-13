import { describe, expect, test } from "bun:test";
import { formatIsoDatePtBr } from "./date-format";

describe("date formatting", () => {
  test("formats ISO dates as Brazilian dates", () => {
    expect(formatIsoDatePtBr("2026-07-08")).toBe("08/07/2026");
  });

  test("keeps unknown formats unchanged", () => {
    expect(formatIsoDatePtBr("2026")).toBe("2026");
  });
});
