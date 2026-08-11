"use client";

/**
 * components/settings/api.ts
 *
 * Settings-side fetch helper. Deliberately NOT lib/clientFetch.ts: that one
 * swallows every failure and returns null because the TV must keep its last
 * good state rather than show an error. Here the opposite is true — if a save
 * failed, the person who pressed the button has to be told why, so this
 * surfaces the server's error message instead.
 */

export interface ApiResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  /** 401 → the PIN session expired; the page re-locks rather than erroring. */
  unauthorized: boolean;
}

export async function settingsRequest<T>(
  url: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // Non-JSON response (proxy error page, etc.) — handled by the !res.ok path.
    }

    if (!res.ok) {
      const message =
        (payload as { error?: string } | null)?.error ??
        `Request failed (${res.status})`;
      return { ok: false, data: null, error: message, unauthorized: res.status === 401 };
    }

    return { ok: true, data: payload as T, error: null, unauthorized: false };
  } catch (err) {
    console.error(`[settings] ${url} failed:`, err);
    return {
      ok: false,
      data: null,
      error: "Could not reach the server. Check your connection and try again.",
      unauthorized: false,
    };
  }
}
