/**
 * Test-only fake for the auth boundary used by route guards.
 *
 * The real src/lib/auth.ts reaches into Next's request scope (cookies +
 * connection()), which only exists inside a running Next server. The guard
 * contract under test is just "getCurrentUser() returns the user or null", so
 * this fake stands in for exactly that.
 *
 * Routes under test import "@/lib/auth"; the test resolver in routes.test.ts
 * redirects that specifier here.
 */

let user: { id: string } | null = null;

export function __setUser(next: { id: string } | null): void {
  user = next;
}

export function __reset(): void {
  user = null;
}

export async function getCurrentUser(): Promise<{ id: string } | null> {
  return user;
}
