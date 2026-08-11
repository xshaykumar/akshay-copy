import { describe, expect, it } from "vitest";
import {
  addElapsedDays,
  formatPlanDuration,
  serviceCycleCount,
} from "../lib/plans/duration";
import {
  publicPlanDurations,
  publicPlans,
  publicPlanTotal,
} from "../lib/plans/public-catalog";

describe("fixed-day plans", () => {
  it("uses elapsed days instead of calendar-month boundaries", () => {
    expect(
      addElapsedDays(
        new Date("2028-02-10T12:00:00.000Z"),
        30,
      ).toISOString(),
    ).toBe("2028-03-11T12:00:00.000Z");
    expect(
      addElapsedDays(
        new Date("2027-02-10T12:00:00.000Z"),
        30,
      ).toISOString(),
    ).toBe("2027-03-12T12:00:00.000Z");
  });

  it("maps 90, 180, and 365 days to three, six, and twelve cycles", () => {
    expect(serviceCycleCount(90)).toBe(3);
    expect(serviceCycleCount(180)).toBe(6);
    expect(serviceCycleCount(365)).toBe(12);
    expect(formatPlanDuration(365)).toBe("12 months (365 days)");
    expect(() => serviceCycleCount(30)).toThrow();
  });

  it("defines all eighteen commercial plan-duration prices", () => {
    const entries = publicPlans.flatMap((plan) =>
      publicPlanDurations.map((durationDays) => ({
        code: `${plan.slug}-${durationDays}`,
        price: publicPlanTotal(plan, durationDays),
      })),
    );

    expect(entries).toHaveLength(18);
    expect(new Set(entries.map((entry) => entry.code)).size).toBe(18);
    expect(entries).toContainEqual({ code: "online-basic-90", price: 13_500 });
    expect(entries).toContainEqual({
      code: "athlete-executive-365",
      price: 1_350_000,
    });
  });
});
