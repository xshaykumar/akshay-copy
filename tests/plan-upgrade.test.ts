import { describe, expect, it } from "vitest";
import { calculateOnlineBasicUpgrade } from "../lib/plans/upgrade-rules";

const day = 24 * 60 * 60 * 1000;
const start = new Date("2026-09-01T06:00:00.000Z");

function quote(input: {
  cycleNumber: number;
  requestedDay: number;
  totalCycles?: number;
}) {
  const cycleStart = new Date(
    start.getTime() + (input.cycleNumber - 1) * 30 * day,
  );
  return calculateOnlineBasicUpgrade({
    now: new Date(cycleStart.getTime() + (input.requestedDay - 1) * day),
    cycleStartsAt: cycleStart,
    cycleEndsAt: new Date(cycleStart.getTime() + 30 * day),
    nextCycleStartsAt: new Date(cycleStart.getTime() + 30 * day),
    currentCycleNumber: input.cycleNumber,
    totalCycles: input.totalCycles ?? 3,
    fromPlanPricePaise: 1_350_000,
    toPlanPricePaise: 2_700_000,
  });
}

describe("Online Basic to Online Elite upgrade", () => {
  it("charges all three cycles on day 1 of cycle 1 and begins on day 2", () => {
    const result = quote({ cycleNumber: 1, requestedDay: 1 });
    expect(result.amountPaise).toBe(1_350_000);
    expect(result.applicableCycles).toBe(3);
    expect(result.requestedOnCycleDayOne).toBe(true);
    expect(result.effectiveAt).toEqual(new Date(start.getTime() + day));
  });

  it("excludes cycle 1 after day 1 and begins at cycle 2", () => {
    const result = quote({ cycleNumber: 1, requestedDay: 2 });
    expect(result.amountPaise).toBe(900_000);
    expect(result.applicableCycles).toBe(2);
    expect(result.requestedOnCycleDayOne).toBe(false);
    expect(result.effectiveAt).toEqual(new Date(start.getTime() + 30 * day));
  });

  it("charges two cycles on day 1 of cycle 2 and begins on its day 2", () => {
    const result = quote({ cycleNumber: 2, requestedDay: 1 });
    expect(result.amountPaise).toBe(900_000);
    expect(result.applicableCycles).toBe(2);
    expect(result.effectiveAt).toEqual(new Date(start.getTime() + 31 * day));
  });

  it("charges only cycle 3 after day 1 of cycle 2", () => {
    const result = quote({ cycleNumber: 2, requestedDay: 8 });
    expect(result.amountPaise).toBe(450_000);
    expect(result.applicableCycles).toBe(1);
    expect(result.effectiveAt).toEqual(new Date(start.getTime() + 60 * day));
  });

  it("blocks an upgrade during the last cycle", () => {
    expect(() => quote({ cycleNumber: 3, requestedDay: 1 })).toThrow(
      "final service cycle",
    );
  });
});
