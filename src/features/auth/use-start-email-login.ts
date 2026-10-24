import { useMutation } from "@tanstack/react-query";
import { startEmailLogin } from "./actions";

/** Asks the server to email a login code (also used to resend it). */
export function useStartEmailLogin() {
  return useMutation({ mutationFn: (email: string) => startEmailLogin(email) });
}
