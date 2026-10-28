import { useMutation, useQueryClient } from "@tanstack/react-query";
import { meKey, type User } from "@/features/auth/actions";
import { stashFriendCode } from "@/features/friends/handle-friend-link";
import { updateProfile } from "./actions";

type Vars = {
  /** What changed; null when nothing did (the call then only stashes the friend code). */
  changes: { name: string; username: string; bio?: string } | null;
  /** A code typed by hand: claimed first, so a wrong one fails before anything is saved. */
  friendCode?: string;
  /** Runs once the server saved the changes and before the cache (and so the auth gate) sees them. */
  beforeApply?: () => Promise<void>;
};

/** Saves the profile (name, username, description) and puts the result in the cache of `me`. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ changes, friendCode, beforeApply }: Vars) => {
      // A wrong code is told here, before saving: the friendship itself is made once the profile is done.
      if (friendCode?.trim()) await stashFriendCode(friendCode);
      if (!changes) return null;
      const updated = await updateProfile(changes);
      await beforeApply?.();
      return updated;
    },
    onSuccess: (updated) => {
      if (!updated) return;
      queryClient.setQueryData(meKey, (current: User | undefined) => ({
        ...(current ?? updated),
        name: updated.name,
        username: updated.username,
        bio: updated.bio,
      }));
      void queryClient.invalidateQueries({ queryKey: ["trip"] });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}
