import { useRef } from "react";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import type { TripDetail } from "@/features/trips/actions";
import type { MemberAction } from "@/features/trips/roles";
import { useMakeAdmin } from "./use-make-admin";
import { useRemoveAdmin } from "./use-remove-admin";
import { useRemoveMember } from "./use-remove-member";

type Member = TripDetail["members"][number];

/**
 * Role changes and removal for the members list (shared by "En el rollo" and the full list). `run`'s optional
 * `onDone` fires once the change succeeded; while one runs (`pending`) another is ignored. Only the latest
 * action's error shows: starting one clears the others, and the `others` mutations (e.g. renaming).
 */
export function useMemberActions(tripId: string, others: { reset: () => void }[] = []) {
  const makeAdmin = useMakeAdmin(tripId);
  const removeAdmin = useRemoveAdmin(tripId);
  const removeMember = useRemoveMember(tripId);
  const mine = [makeAdmin, removeAdmin, removeMember];
  // Set the moment one starts: `isPending` only shows after the next render, and a quick second tap beats it.
  const busy = useRef(false);
  const pending = mine.some((m) => m.isPending);
  const pendingAction: MemberAction | null = makeAdmin.isPending ? "makeAdmin" : removeAdmin.isPending ? "removeAdmin" : removeMember.isPending ? "remove" : null;

  const start = (keep?: { reset: () => void }) => {
    for (const m of [...mine, ...others]) if (m !== keep) m.reset();
  };
  const release = () => {
    busy.current = false;
  };
  const confirmRemove = (m: Member, onDone?: () => void) =>
    Alert.alert(`¿Sacar a ${m.name} del rollo?`, "Sus fotos se quedan. Solo un admin lo puede volver a sumar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sacar",
        style: "destructive",
        onPress: () => {
          if (busy.current) return;
          start(removeMember);
          busy.current = true;
          removeMember.mutate(m.id, { onSuccess: onDone, onSettled: release });
        },
      },
    ]);
  const run = (action: MemberAction, m: Member, onDone?: () => void) => {
    if (pending || busy.current) return;
    if (action === "makeAdmin") {
      start(makeAdmin);
      busy.current = true;
      makeAdmin.mutate(m.id, { onSuccess: onDone, onSettled: release });
    } else if (action === "removeAdmin") {
      start(removeAdmin);
      busy.current = true;
      removeAdmin.mutate(m.id, { onSuccess: onDone, onSettled: release });
    } else confirmRemove(m, onDone);
  };
  const failure =
    errorMessage(makeAdmin.error, "No se pudo hacer admin") ??
    errorMessage(removeAdmin.error, "No se pudo quitar como admin") ??
    errorMessage(removeMember.error, "No se pudo sacar del rollo");
  return { run, start, failure, pending, pendingAction };
}
