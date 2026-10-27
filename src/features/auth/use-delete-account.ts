import { useMutation } from "@tanstack/react-query";
import { deleteAccount } from "./actions";

/** Deletes the account. Only on success the session is cleared and the gate sends you to the login. */
export function useDeleteAccount() {
  return useMutation({ mutationFn: () => deleteAccount() });
}
