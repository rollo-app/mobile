import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { fetchFriend } from "./actions";

export const friendKey = (userId: string) => ["friends", userId] as const;

/**
 * A friend's profile and your rolls in common. `notFriend` when the server says you aren't friends
 * (404: they removed you, or the id is unknown); `error` appears only if there's no data at all.
 */
export function useFriend(userId: string) {
  const query = useQuery({ queryKey: friendKey(userId), queryFn: () => fetchFriend(userId) });
  const notFriend = query.error instanceof ApiError && query.error.status === 404;
  const profile = notFriend ? null : (query.data ?? null);
  return {
    profile,
    notFriend,
    error: profile || notFriend ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudo cargar el perfil") : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
