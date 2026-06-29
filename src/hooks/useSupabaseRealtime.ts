import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Escuta mudanças em tempo real de uma ou mais tabelas do Supabase
 * e invalida as query keys do React Query automaticamente.
 */
export function useRealtimeInvalidation(
  tables: string[],
  queryKeys: string[][],
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (tables.length === 0) return;

    const channelName = `realtime-${tables.join("-")}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        },
      );
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [tables.join(","), JSON.stringify(queryKeys)]);
}

/**
 * Escuta mudanças em tempo real de uma ou mais tabelas do Supabase
 * e chama uma callback de refetch. Para hooks que usam useState/useEffect.
 */
export function useRealtimeRefetch(
  tables: string[],
  refetch: () => void,
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (tables.length === 0) return;

    const channelName = `realtime-refetch-${tables.join("-")}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          refetchRef.current();
        },
      );
    });

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [tables.join(",")]);
}
