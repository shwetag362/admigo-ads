// lib/observability/logger.ts
// Structured, level-based logger — the go-forward standard for new/refactored
// code. Emits pretty lines in development and single-line JSON in production
// (parseable by any log aggregator). Redacts obvious secrets.
//
// This replaces ad-hoc console.* usage. The legacy lib/logger.js remains for its
// existing callers; migrate them to this over time.

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level =
  (process.env.LOG_LEVEL as Level) ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "accessToken",
  "refreshToken",
  "access_token",
  "refresh_token",
  "token",
  "authorization",
  "cookie",
]);

function redact(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k) ? "[REDACTED]" : redact(v, seen);
  }
  return out;
}

function serializeError(err: unknown) {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      // Carry through Meta/Facebook SDK error fields when present.
      ...("code" in err ? { code: (err as { code?: unknown }).code } : {}),
    };
  }
  return err;
}

function emit(level: Level, msg: string, context?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const ctx = context ? (redact(context) as Record<string, unknown>) : undefined;

  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...ctx });
    (level === "error" ? console.error : console.log)(line);
    return;
  }

  const tag = { debug: "·", info: "ℹ", warn: "⚠", error: "✖" }[level];
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`${tag} ${msg}`, ctx ?? "");
}

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => emit("warn", msg, ctx),
  error: (msg: string, err?: unknown, ctx?: Record<string, unknown>) =>
    emit("error", msg, { ...ctx, error: serializeError(err) }),
  /** Create a child logger that stamps every line with `base` context. */
  child: (base: Record<string, unknown>) => ({
    debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, { ...base, ...c }),
    info: (m: string, c?: Record<string, unknown>) => emit("info", m, { ...base, ...c }),
    warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, { ...base, ...c }),
    error: (m: string, err?: unknown, c?: Record<string, unknown>) =>
      emit("error", m, { ...base, ...c, error: serializeError(err) }),
  }),
};

export type Logger = typeof logger;
