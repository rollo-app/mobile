import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userKey } from "@/features/profile/use-user";
import { removeFriend, type Friend } from "./actions";
import { friendsKey } from "./use-friends";

/**
 * Removes a friend: they leave the cached list at once. Their profile is only marked stale: removing the friend
 * cache here would refetch it during the dismiss and get a 404 (it's garbage-collected once the screen unmounts).
 */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeFriend(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<Friend[]>(friendsKey, (current) => current?.filter((f) => f.id !== userId));
      void queryClient.invalidateQueries({ queryKey: userKey(userId), refetchType: "none" });
    },
  });
}
