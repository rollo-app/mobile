import { useQuery } from "@tanstack/react-query";
import { fetchUserFriends } from "./actions";

export const userFriendsKey = (userId: string) => ["userFriends", userId] as const;

/**
 * Someone's friends: all of them (`scope: "all"`) if you may see their profile, else only the ones in
 * common. `data` is the latest known list even if stale; `error` appears only if there's no data at all.
 */
export function useUserFriends(userId: string | undefined) {
  const query = useQuery({
    queryKey: userFriendsKey(userId ?? ""),
    queryFn: () => fetchUserFriends(userId!),
    enabled: !!userId,
  });
  const data = query.data ?? null;
  return {
    data,
    error: data ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar los amigos") : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
