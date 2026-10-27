import { useMutation } from "@tanstack/react-query";
import { logout } from "./actions";

/** Logs out. The session flips the gate on its own, so there is no cache work here. */
export function useLogOut() {
  return useMutation({ mutationFn: () => logout() });
}
