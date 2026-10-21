import { useQuery } from "@tanstack/react-query";
import { fetchFriends } from "./actions";

export const friendsKey = ["friends"] as const;

/** Your friends, by name. Cached like the rest; `error` appears only if there's no data at all. */
export function useFriends() {
  const query = useQuery({ queryKey: friendsKey, queryFn: fetchFriends });
  const friends = query.data ?? null;
  return {
    friends,
    error: friends ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar tus amigos") : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
