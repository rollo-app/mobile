import { useMutation } from "@tanstack/react-query";
import { signInWithGoogle } from "./actions";

/** Signs in with Google. Like the code, the session flips the gate on its own; a closed picker resolves to null. */
export function useGoogleSignIn() {
  return useMutation({ mutationFn: signInWithGoogle });
}
