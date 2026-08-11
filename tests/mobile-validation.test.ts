import { describe, expect, it } from "vitest";
import { indianMobileSchema } from "../lib/contact/mobile";

describe("Indian mobile validation", () => {
  it("normalizes common valid formats", () => {
    expect(indianMobileSchema.parse("98765 43210")).toBe("+919876543210");
    expect(indianMobileSchema.parse("+91-98765-43210")).toBe(
      "+919876543210",
    );
  });

  it("requires the registration mobile number", () => {
    expect(indianMobileSchema.safeParse("").success).toBe(false);
    expect(indianMobileSchema.safeParse(undefined).success).toBe(false);
  });

  it("rejects invalid Indian mobile numbers", () => {
    const shortNumber = indianMobileSchema.safeParse("12345");
    expect(shortNumber.success).toBe(false);
    if (!shortNumber.success) {
      expect(shortNumber.error.issues[0]?.message).toContain("10-digit");
    }
    expect(indianMobileSchema.safeParse("5876543210").success).toBe(false);
  });
});
