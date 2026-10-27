import { useQuery } from "@tanstack/react-query";
import { OWN_DATA_STALE_TIME } from "@/api/query-client";
import { fetchMe, meKey } from "./actions";
import { useSession } from "./use-session";

/**
 * The signed-in user (`GET /me`). Cached and persisted: `me` is the latest known data even if
 * stale; `failed` is true only if there's no data at all.
 */
export function useMe() {
  const { status, token } = useSession();
  const query = useQuery({ queryKey: meKey, queryFn: fetchMe, enabled: status === "in", staleTime: OWN_DATA_STALE_TIME });
  return {
    session: status,
    token,
    me: query.data,
    failed: !query.data && query.isError,
    refetch: query.refetch,
  };
}
