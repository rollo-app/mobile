import { useQuery } from "@tanstack/react-query";
import { fetchFriendRequests } from "./actions";

export const friendRequestsKey = ["friend-requests"] as const;

/** Requests waiting for your answer. `null` until loaded or if it can't be (the Amigos tab then just doesn't show the section). */
export function useFriendRequests() {
  const query = useQuery({ queryKey: friendRequestsKey, queryFn: fetchFriendRequests });
  return { requests: query.data ?? null };
}

/** The full list for the Solicitudes screen: like `useFriendRequests`, plus the load error (only if there's no data at all) and a retry. */
export function useFriendRequestsList() {
  const query = useQuery({ queryKey: friendRequestsKey, queryFn: fetchFriendRequests });
  const requests = query.data ?? null;
  return {
    requests,
    error: requests ? null : query.isError ? (query.error instanceof Error ? query.error.message : "No se pudieron cargar las solicitudes") : null,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
