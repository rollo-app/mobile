import { queryClient } from "@/api/query-client";
import { meKey, type User } from "@/features/auth/actions";
import * as profileActions from "@/features/profile/actions";
import type { TripSummary } from "@/features/trips/active";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { setActiveTripId } from "@/storage/active-trip";
import { setSessionToken } from "@/storage/session";
import { setSessionUserId } from "@/storage/session-user";

export const USER: User = { id: "u1", email: "juani@rollo.test", name: "Juani", username: "juani", avatarUrl: null, bio: null, badge: null, profileVisibility: "friends", canCreateEvents: false };

export const tripSummary = (id: string, name: string, over: Partial<TripSummary> = {}): TripSummary => ({
  id,
  name,
  joinCode: "HUB5FT",
  startsAt: 0,
  endsAt: 1,
  revealAt: 1,
  revealed: false,
  role: "admin",
  isCreator: true,
  archived: false,
  totalUploaded: 0,
  momentMode: "off",
  coverThumbhash: null,
  type: "trip",
  coverUrl: null,
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
  await setSessionUserId(user.id);
  queryClient.setQueryData(meKey, user);
  queryClient.setQueryData(myTripsKey, { trips });
  if (active) await setActiveTripId(active);
}

/**
 * Perfil is always mounted in the tabs and loads your own profile (`GET /users/{id}`). Suites that aren't about it
 * call this to leave that request pending: it never answers, so no late update leaks into the next test's act()
 * and the request stays out of recorded fetch calls. Call it after any mock reset.
 */
export const stubOwnProfile = () => jest.spyOn(profileActions, "fetchUser").mockReturnValue(new Promise(() => {}));
