/**
 * lib/db.ts — shared PostgREST pagination helper (dry-audit E3).
 *
 * Supabase caps a single select at 1000 rows; every "fetch the whole window"
 * query must page. This is the one implementation — don't hand-roll the loop.
 */

interface PageResult {
  data: unknown;
  error: { message: string } | null;
}

interface PaginateOptions {
  /** Rows per page — PostgREST's server-side cap is 1000. */
  pageSize?: number;
  /** Hard stop so a runaway table can never loop forever. */
  maxPages?: number;
}

/**
 * Drain a paged query. `fetchPage` receives the inclusive [from, to] range and
 * must apply it via `.range(from, to)` along with its own select/filter/order.
 * Stops at the first short page or after `maxPages`.
 */
export async function paginateAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>,
  { pageSize = 1000, maxPages = 250 }: PaginateOptions = {},
): Promise<{ rows: T[]; error: Error | null }> {
  const rows: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const from = p * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows: [], error: new Error(error.message) };
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return { rows, error: null };
}
