import { useMutation } from "@tanstack/react-query";
import { verifyCode } from "./actions";

/** Verifies the emailed code. The session flips the gate on its own, so there is no cache work here. */
export function useVerifyCode() {
  return useMutation({ mutationFn: ({ email, code }: { email: string; code: string }) => verifyCode(email, code) });
}
