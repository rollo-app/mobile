import { useQuery } from "@tanstack/react-query";
import { fetchFriendRequests } from "./actions";

export const friendRequestsKey = ["friend-requests"] as const;

/** Requests waiting for your answer. `null` until loaded or if it can't be (the Amigos tab then just doesn't show the section). */
export function useFriendRequests() {
  const query = useQuery({ queryKey: friendRequestsKey, queryFn: fetchFriendRequests });
  return { requests: query.data ?? null };
}
