/**
 * Guest deep-link helpers.
 *
 * A QR code points at `/join/{code}`. If the guest is not signed in yet, that
 * destination has to survive the trip through login/signup (and the Stripe
 * card step) so the guest lands back on the event instead of the dashboard.
 */

/**
 * Returns a safe guest deep link, or null. Only local guest event paths are
 * accepted — an absolute URL or protocol-relative path must never become a
 * post-login redirect target.
 */
export function getGuestDeepLink(
  value?: string | string[] | null
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return null;
  }

  const isJoin = raw === "/join" || raw.startsWith("/join/");
  const isRequest = raw === "/request" || raw.startsWith("/request?");
  if (!isJoin && !isRequest) return null;

  return raw;
}

/** Query-string suffix for passing a deep link between auth pages. */
export function guestDeepLinkQuery(value?: string | string[] | null): string {
  const next = getGuestDeepLink(value);
  return next ? `?next=${encodeURIComponent(next)}` : "";
}
