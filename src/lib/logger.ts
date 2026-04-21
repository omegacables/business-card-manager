/**
 * Logger with PII (Personally Identifiable Information) masking.
 * - In production: suppresses log/info output; errors always go through.
 * - Always use mask* helpers when logging user-related data.
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};

/** Mask an email so logs don't leak full addresses. */
export function maskEmail(email?: string | null): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 0) return email.slice(0, 2) + "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const maskedLocal = local.length <= 2 ? local[0] + "*" : local.slice(0, 2) + "***";
  return `${maskedLocal}@${domain}`;
}

/** Mask a long ID (UUID, LINE user id, Auth0 sub). */
export function maskId(id?: string | null): string {
  if (!id) return "";
  if (id.length <= 8) return id.slice(0, 2) + "***";
  return id.slice(0, 8) + "***";
}
