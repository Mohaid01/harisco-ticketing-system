type LogMeta = Record<string, unknown>;

// Blacklist of keys that should never be written to logs in plain text
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "oldpassword",
  "newpassword",
  "credential",
];

/**
 * Recursively removes sensitive properties from log metadata to prevent credential leaks.
 */
const redactMeta = (obj: unknown): unknown => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactMeta);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      redacted[key] = redactMeta(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
};

/**
 * Standardized system logger for structured JSON tracking.
 */
export const logger = {
  /**
   * Internal formatting function to build a structured JSON payload
   */
  format: (level: string, message: string, meta?: unknown): string => {
    const now = new Date();
    const cleanMeta = meta ? (redactMeta(meta) as LogMeta) : {};

    return JSON.stringify({
      level,
      date: now.toISOString().split("T")[0],
      time: now.toTimeString().split(" ")[0],
      timestamp: now.toISOString(),
      message,
      ...cleanMeta,
    });
  },

  info: (message: string, meta?: LogMeta | unknown): void => {
    console.log(logger.format("info", message, meta));
  },

  warn: (message: string, meta?: LogMeta | unknown): void => {
    console.warn(logger.format("warn", message, meta));
  },

  error: (message: string, meta?: LogMeta | unknown): void => {
    // 1. Cast meta safely so we can evaluate its properties internally
    const metaObj = meta as Record<string, unknown> | undefined;

    // 2. Safely extract error properties if they exist and match the Error object
    const errorDetails =
      metaObj?.error instanceof Error
        ? {
            ...metaObj,
            error: metaObj.error.message,
            stack: metaObj.error.stack,
          }
        : metaObj;

    // 3. Cast the cleaned output back to LogMeta for the formatter
    console.error(
      logger.format("error", message, errorDetails as LogMeta | undefined),
    );
  },

  security: (message: string, meta?: LogMeta | unknown): void => {
    console.log(logger.format("security", message, meta));
  },
};
