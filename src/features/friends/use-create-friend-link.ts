import { useMutation } from "@tanstack/react-query";
import { createFriendLink } from "./actions";

/** Makes a friend link (it lasts an hour and replaces the previous one); the screen keeps the one it got. */
export function useCreateFriendLink() {
  return useMutation({ mutationFn: () => createFriendLink() });
}
