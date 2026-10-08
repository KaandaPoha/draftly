/**
 * Pure helpers for the query-param tab layout.
 *
 * Kept in a plain .ts module (no JSX) so the test runner can import it, and
 * so the server-rendered `<Tabs>` component in components/ui.tsx shares one
 * definition of how a tab link is built.
 */

/**
 * Build the href for one tab.
 *
 * Carries the chosen tab id in the query string and preserves any other query
 * state (notices, failure reasons, wizard fields) across tab switches. Extra
 * params whose value is undefined or an empty string are dropped so the URL
 * stays clean.
 */
export function tabHref(
  basePath: string,
  tabKey: string,
  params: Record<string, string | undefined>,
  tabId: string,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v);
  }
  q.set(tabKey, tabId);
  return `${basePath}?${q.toString()}`;
}
