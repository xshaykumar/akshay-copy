import { z } from "zod";

export const indianMobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(?:\+91|91)?[6-9]\d{9}$/,
        "Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      ),
  )
  .transform((value) => `+91${value.slice(-10)}`);
