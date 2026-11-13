import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGroup, deleteGroup, renameGroup } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { feedKey } from "@/features/trips/use-feed";
import { tripKey } from "@/features/trips/use-trip-detail";

/** Organizer actions on an event's groups; each refreshes the detail and your list. */
export function useGroupMutations(tripId: string) {
  const client = useQueryClient();
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: tripKey(tripId) }), client.invalidateQueries({ queryKey: myTripsKey }),
      // Groups decide which photos a guest sees (prefix of both the asc and desc caches).
      client.invalidateQueries({ queryKey: feedKey(tripId) }),
    ]);
  return {
    create: useMutation({ mutationFn: (name: string) => createGroup(tripId, name), onSuccess: refresh }),
    rename: useMutation({ mutationFn: (v: { groupId: string; name: string }) => renameGroup(tripId, v.groupId, v.name), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (groupId: string) => deleteGroup(tripId, groupId), onSuccess: refresh }),
  };
}
