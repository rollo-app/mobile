import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/api/client";
import { userKey } from "@/features/profile/use-user";
import type { UserProfile } from "@/features/profile/actions";
import { acceptFriendRequest, cancelFriendRequest, rejectFriendRequest, sendFriendRequest, type FriendRequest } from "./actions";
import { afterAction } from "./friend-request";
import { friendRequestsKey } from "./use-friend-requests";
import { friendsKey } from "./use-friends";

type Action = "send" | "cancel" | "accept" | "reject";

const call: Record<Action, (userId: string) => Promise<unknown>> = {
  send: sendFriendRequest,
  cancel: cancelFriendRequest,
  accept: acceptFriendRequest,
  reject: rejectFriendRequest,
};

const FALLBACK: Record<Action, string> = {
  send: "No se pudo mandar la solicitud",
  cancel: "No se pudo cancelar la solicitud",
  accept: "No se pudo aceptar la solicitud",
  reject: "No se pudo rechazar la solicitud",
};

/**
 * Send, cancel, accept or reject a friend request with someone. The profile (button) and the received list change at once
 * and go back if the server says no; afterwards everything that depends on who your friends are refreshes.
 * `error` is the message of the last failed action.
 */
export function useFriendRequest(userId: string) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ action }: { action: Action }) => call[action](userId),
    onMutate: async ({ action }) => {
      await Promise.all([userKey(userId), friendRequestsKey].map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const profile = queryClient.getQueryData<UserProfile>(userKey(userId));
      const received = queryClient.getQueryData<FriendRequest[]>(friendRequestsKey);
      if (profile) queryClient.setQueryData(userKey(userId), afterAction(profile, action));
      if (received && (action === "accept" || action === "reject")) {
        queryClient.setQueryData(friendRequestsKey, received.filter((r) => r.user.id !== userId));
      }
      return { profile, received };
    },
    onError: (_error, _vars, previous) => {
      if (previous?.profile) queryClient.setQueryData(userKey(userId), previous.profile);
      if (previous?.received) queryClient.setQueryData(friendRequestsKey, previous.received);
    },
    onSettled: () =>
      Promise.all([userKey(userId), friendRequestsKey, friendsKey, ["userFriends"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });

  const lastAction = mutation.variables?.action;
  return {
    send: () => mutation.mutate({ action: "send" }),
    cancel: () => mutation.mutate({ action: "cancel" }),
    accept: () => mutation.mutate({ action: "accept" }),
    reject: () => mutation.mutate({ action: "reject" }),
    busy: mutation.isPending,
    error: mutation.isError && lastAction ? errorMessage(mutation.error, FALLBACK[lastAction]) : null,
  };
}
