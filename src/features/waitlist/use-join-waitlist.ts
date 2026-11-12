import { useMutation } from "@tanstack/react-query";
import { joinWaitlist } from "./actions";

/** Adds an email to the waitlist. */
export function useJoinWaitlist() {
  return useMutation({ mutationFn: (email: string) => joinWaitlist(email) });
}
