"use client";

/**
 * hooks/useRealtimeChannel.ts — shared Supabase Realtime subscription with
 * self-healing (dry-audit C2). Extracted from useOnboardingPanelData's
 * reconnect pattern so both data hooks get identical 24/7 resilience:
 *
 *   - CHANNEL_ERROR / TIMED_OUT → call `onError` (refetch the channel's data
 *     to heal missed events), then tear down and resubscribe after 3s.
 *   - Cleanup always goes through `supabase.removeChannel` (memory invariant).
 *   - Channel names are part of the public contract — never rename them here.
 *
 * Handlers are read through a ref at dispatch time, so callers don't need to
 * memoize their config array and handler identity can never churn the socket.
 */

import { useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AnyPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

export interface RealtimeTableConfig {
  table: string;
  /** postgres_changes event filter — defaults to "*". */
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  handler: (payload: AnyPayload) => void;
}

const RECONNECT_DELAY_MS = 3000;

export function useRealtimeChannel(
  channelName: string,
  configs: RealtimeTableConfig[],
  onError?: () => void,
): void {
  const [reconnect, setReconnect] = useState(0);

  // Latest-ref pattern: the subscription registers stable wrappers; the
  // current handlers/onError are read at dispatch time.
  const configsRef = useRef(configs);
  configsRef.current = configs;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Static per call site: the table/event list never changes between renders.
  const shape = configs.map((c) => `${c.table}:${c.event ?? "*"}`).join(",");

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    let ch = client.channel(channelName);
    configsRef.current.forEach((config, i) => {
      ch = ch.on(
        "postgres_changes",
        {
          event: (config.event ?? "*") as "*",
          schema: "public",
          table: config.table,
        },
        (payload: AnyPayload) => configsRef.current[i]?.handler(payload),
      );
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && process.env.NODE_ENV === "development") {
        console.info(`[Realtime] ${channelName} active`);
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onErrorRef.current?.();
        reconnectTimer = setTimeout(
          () => setReconnect((n) => n + 1),
          RECONNECT_DELAY_MS,
        );
      }
    });

    return () => {
      client.removeChannel(ch);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [channelName, shape, reconnect]);
}
