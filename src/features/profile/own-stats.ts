import type { ProfileStatsInput } from "./profile-stats";

/** The numbers line of your own profile, or undefined while there isn't enough to draw it without a flash of "Todavía no tenés amigos". */
export function ownStats({
  friends,
  profile,
  featuredLength,
  profileFailed,
}: {
  /** useFriends(); undefined while loading */
  friends: number | undefined;
  profile: { rollCount: number | null; featuredCount: number | null } | null;
  featuredLength: number | undefined;
  /** useUser() has no data and errored: stop waiting and say what we know */
  profileFailed: boolean;
}): ProfileStatsInput | undefined {
  if (friends === undefined) return undefined;
  if (!profile) return friends === 0 && !profileFailed ? undefined : { friends, own: true };
  return { rolls: profile.rollCount, photos: featuredLength ?? profile.featuredCount, friends, own: true };
}
