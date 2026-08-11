import "server-only";

import { z } from "zod";

const serverEnvironmentSchema = z
  .object({
    APP_URL: z.url().optional(),
    APP_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    PAYMENTS_MODE: z.enum(["mock", "provider"]).default("mock"),
    SUPABASE_SECRET_KEY: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    DATABASE_MIGRATION_URL: z.string().min(1),
    APP_RUNTIME_DATABASE_PASSWORD: z.string().min(16),
    RAZORPAY_KEY_ID: z
      .string()
      .regex(/^rzp_(test|live)_[A-Za-z0-9]+$/)
      .optional(),
    RAZORPAY_KEY_SECRET: z.string().min(8).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(16).optional(),
    ADMIN_EMAIL: z.email(),
    CRON_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(16).optional(),
    ),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((environment, context) => {
    if (environment.APP_ENV === "production" && !environment.CRON_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["CRON_SECRET"],
        message: "CRON_SECRET is required in production.",
      });
    }
    if (environment.PAYMENTS_MODE === "provider") {
      if (!environment.RAZORPAY_KEY_ID) {
        context.addIssue({
          code: "custom",
          path: ["RAZORPAY_KEY_ID"],
          message: "RAZORPAY_KEY_ID is required when provider payments are enabled.",
        });
      }
      if (!environment.RAZORPAY_KEY_SECRET) {
        context.addIssue({
          code: "custom",
          path: ["RAZORPAY_KEY_SECRET"],
          message: "RAZORPAY_KEY_SECRET is required when provider payments are enabled.",
        });
      }
      if (!environment.RAZORPAY_WEBHOOK_SECRET) {
        context.addIssue({
          code: "custom",
          path: ["RAZORPAY_WEBHOOK_SECRET"],
          message:
            "RAZORPAY_WEBHOOK_SECRET is required when provider payments are enabled.",
        });
      }
    }
    if (
      environment.APP_ENV === "production" &&
      environment.RAZORPAY_KEY_ID?.startsWith("rzp_test_")
    ) {
      context.addIssue({
        code: "custom",
        path: ["RAZORPAY_KEY_ID"],
        message: "Test Razorpay credentials are forbidden in production.",
      });
    }
  });

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnv(): ServerEnvironment {
  if (!cachedEnvironment) {
    cachedEnvironment = serverEnvironmentSchema.parse({
      APP_URL: process.env.APP_URL,
      APP_ENV: process.env.APP_ENV,
      PAYMENTS_MODE: process.env.PAYMENTS_MODE,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
      APP_RUNTIME_DATABASE_PASSWORD:
        process.env.APP_RUNTIME_DATABASE_PASSWORD,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
      ADMIN_EMAIL: process.env.ADMIN_EMAIL,
      CRON_SECRET: process.env.CRON_SECRET,
      LOG_LEVEL: process.env.LOG_LEVEL,
    });

    if (
      cachedEnvironment.APP_ENV === "production" &&
      cachedEnvironment.PAYMENTS_MODE === "mock"
    ) {
      throw new Error("Mock payments are forbidden in production.");
    }
  }

  return cachedEnvironment;
}
