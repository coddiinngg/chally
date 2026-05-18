import * as Sentry from "@sentry/react";

const DSN = process.env.SENTRY_DSN;
const enabled = Boolean(DSN);

export function initSentry() {
  if (!enabled) return;
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export function setSentryUser(user: { id: string; email?: string | null } | null) {
  if (!enabled) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email ?? undefined });
  } else {
    Sentry.setUser(null);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
