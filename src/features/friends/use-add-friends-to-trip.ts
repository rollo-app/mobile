import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { tripKey } from "@/features/trips/use-trip-detail";
import { addFriendsToTrip, type AddMemberResult } from "./actions";
import { friendKey } from "./use-friend";

const ADD_KEY = ["add-friends-to-trip"];
type Vars = { tripId: string; friendIds: string[] };

/**
 * Adds friends to a roll. The server answers per friend ("added" / "unavailable"): the roll's detail is refetched
 * and so is the profile of each one who got in; the screen reads the results in its `onSuccess`. A second call while
 * one is pending is ignored.
 */
export function useAddFriendsToTrip() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: ADD_KEY,
    mutationFn: ({ tripId, friendIds }: Vars) => addFriendsToTrip(tripId, friendIds),
    onSuccess: async (results, { tripId }) => {
      const added = results.filter((r) => r.status === "added");
      await Promise.all([
        ...added.map((r) => client.invalidateQueries({ queryKey: friendKey(r.userId) })),
        client.invalidateQueries({ queryKey: tripKey(tripId) }),
      ]);
    },
  });
  const { mutate } = mutation;

  // Checks the cache, not `isPending`: that only flips on the next render, after a fast second pick.
  const add = useCallback(
    (vars: Vars, onSuccess?: (results: AddMemberResult[]) => void) => {
      if (client.getMutationCache().findAll({ mutationKey: ADD_KEY, status: "pending" }).length > 0) return;
      mutate(vars, { onSuccess: onSuccess && ((results) => onSuccess(results)) });
    },
    [client, mutate],
  );

  return { add, adding: mutation.isPending, error: mutation.error, reset: mutation.reset };
}
