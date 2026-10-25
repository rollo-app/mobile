import { queryClient } from "@/api/query-client";
import { meKey, type User } from "@/features/auth/actions";
import type { TripSummary } from "@/features/trips/active";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { setActiveTripId } from "@/storage/active-trip";
import { setSessionToken } from "@/storage/session";

export const USER: User = { id: "u1", email: "juani@rollo.test", name: "Juani", username: "juani", avatarUrl: null, bio: null, badge: null, profileVisibility: "friends" };

export const tripSummary = (id: string, name: string, over: Partial<TripSummary> = {}): TripSummary => ({
  id,
  name,
  joinCode: "HUB5FT",
  startsAt: 0,
  endsAt: 1,
  revealAt: 1,
  revealed: false,
  role: "admin",
  totalUploaded: 0,
  momentMode: "off",
  coverThumbhash: null,
  ...over,
});

/**
 * Signs in as `user` with the trips in `trips` (the first is the active one unless `active` says
 * otherwise): the session token goes to the keychain and `/me` and `/me/trips` to the query cache,
 * so screens render without asking the server.
 */
export async function signInAs({
  user = USER,
  trips = [],
  active,
}: { user?: User; trips?: TripSummary[]; active?: string } = {}) {
  await setSessionToken("session-token");
  queryClient.setQueryData(meKey, user);
  queryClient.setQueryData(myTripsKey, { trips });
  if (active) await setActiveTripId(active);
}
