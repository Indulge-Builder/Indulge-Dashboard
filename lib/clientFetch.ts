/**
 * lib/clientFetch.ts — the one client-side fetch wrapper (dry-audit C1).
 *
 * Every dashboard fetcher is the same skeleton: no-store GET → res.ok guard →
 * parse JSON → null on any failure (the TV keeps its last good state; errors
 * are logged, never rendered). Aborts return null silently.
 */

export async function fetchJson<T>(
  url: string,
  init?: { signal?: AbortSignal },
): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: init?.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return null;
    console.error(`[fetchJson] ${url} failed:`, err);
    return null;
  }
}
