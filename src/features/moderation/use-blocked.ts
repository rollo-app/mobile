import { useQuery } from "@tanstack/react-query";
import { OWN_DATA_STALE_TIME } from "@/api/query-client";
import { fetchBlocked } from "./actions";

export const blockedKey = ["blocked"] as const;

/** The people you blocked. Cached like the rest; `error` appears only if there's no data at all. */
export function useBlocked() {
  const query = useQuery({ queryKey: blockedKey, queryFn: fetchBlocked, staleTime: OWN_DATA_STALE_TIME });
  const blocked = query.data ?? null;
  return {
    blocked,
    error: blocked ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar los bloqueos") : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
