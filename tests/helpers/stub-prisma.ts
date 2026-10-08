/**
 * Test-only fake for the Prisma boundary used by route guards.
 *
 * Only the queries the routes under test actually make are faked, and each
 * fake returns canned rows — nothing touches SQLite. `__setProbe` lets a test
 * observe the query (including its where clause) instead of a fixed row, so
 * user-scoping can be asserted.
 *
 * Routes under test import "@/lib/prisma"; the test resolver in routes.test.ts
 * redirects that specifier here.
 */

type DraftRow = Record<string, unknown> | null;
type Probe = () => DraftRow;

let draft: DraftRow = null;
let probe: Probe | null = null;
let lastWhere: Record<string, unknown> | null = null;

export function __setDraft(row: DraftRow): void {
  draft = row;
}

/** Install a callback that is asked for a row on every query. */
export function __setProbe(fn: Probe): void {
  probe = fn;
}

export function __reset(): void {
  draft = null;
  probe = null;
  lastWhere = null;
}

/** The where clause of the most recent query, for scoping assertions. */
export function __lastWhere(): Record<string, unknown> | null {
  return lastWhere;
}

export const prisma = {
  contentDraft: {
    async findFirst({ where }: { where?: Record<string, unknown> } = {}): Promise<DraftRow> {
      lastWhere = where ?? null;
      return probe ? probe() : draft;
    },
  },
};
