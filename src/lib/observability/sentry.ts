import * as Sentry from "@sentry/react";

const SENSITIVE_KEY_RE =
  /(provvigion|markup|storno|password|service_role|secret|token|api[_-]?key)/i;

function scrubObj(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = SENSITIVE_KEY_RE.test(k) ? "[redacted]" : v;
  }
  return result;
}

/** Pure function — no Sentry calls; wide types for testability without mocking Sentry. */
export function scrubSentryEvent(
  event: Record<string, unknown>,
): Record<string, unknown> {
  if (!event || typeof event !== "object") return event;

  const copy: Record<string, unknown> = { ...event };

  if (copy["request"] && typeof copy["request"] === "object") {
    const { data: _data, ...rest } = copy["request"] as Record<string, unknown>;
    copy["request"] = rest;
  }

  for (const field of ["extra", "contexts", "tags"]) {
    const val = copy[field];
    if (val && typeof val === "object") {
      copy[field] = scrubObj(val as Record<string, unknown>);
    }
  }

  return copy;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // NESSUNA integrazione Session Replay: catturerebbe il DOM (bollette + provvigioni)
    beforeSend: (event) =>
      scrubSentryEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as typeof event,
  });
}
