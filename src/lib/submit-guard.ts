/**
 * Double-submit protection for long-running server actions.
 *
 * The wizard and the regenerate button both trigger multi-second provider
 * calls; a rapid double click would otherwise run the generation twice and
 * save two drafts / two versions.
 *
 * The token is the first N bytes of a SHA-256 of the action name and the
 * current minute-window — the same submit within one minute resolves to the
 * same token, so a duplicate click is caught. Cross-tab/multi-window use is
 * not deduplicated (the window differs) — that is out of scope here and
 * harmless: it just means each tab may regenerate once.
 */
import { createHash } from "node:crypto";

/** 60-second window. */
const WINDOW_MS = 60_000;

/** Action name → expiry. In-memory: per server process, which is all a dev MVP needs. */
const recent = new Map<string, number>();

export function submitToken(action: string, payload: string): string {
  const slot = Math.floor(Date.now() / WINDOW_MS);
  return createHash("sha256")
    .update(`${action}|${slot}|${payload}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Returns false when the same action+payload was submitted in the current
 * window (a double click). Marks it as seen when true.
 */
export function once(token: string): boolean {
  const now = Date.now();
  // opportunistic cleanup
  for (const [t, exp] of recent) if (exp < now) recent.delete(t);
  const exp = now + WINDOW_MS;
  if (recent.get(token) && recent.get(token)! > now) return false;
  recent.set(token, exp);
  return true;
}

/** Test-only: clear every remembered token so guard tests start from a known
 *  state. Not exported from any public surface — only the test resolver maps
 *  it in. */
export function __reset(): void {
  recent.clear();
}
