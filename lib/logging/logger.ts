import "server-only";

import pino from "pino";

type SafeLogContext = {
  requestId?: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  status?: string;
  errorCode?: string;
  durationMs?: number;
};

const logger = pino({
  base: undefined,
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    censor: "[REDACTED]",
    paths: [
      "*.password",
      "*.token",
      "*.authorization",
      "*.cookie",
      "*.email",
      "*.phone",
      "*.assessment",
      "*.message",
      "*.payment",
      "*.financial",
    ],
  },
});

export const appLogger = {
  info(event: string, context: SafeLogContext = {}) {
    logger.info(context, event);
  },
  warn(event: string, context: SafeLogContext = {}) {
    logger.warn(context, event);
  },
  error(event: string, context: SafeLogContext = {}) {
    logger.error(context, event);
  },
};
