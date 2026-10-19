import { createApiClient, unwrap, type Schemas } from "@/api/client";
import { API_URL } from "@/config";
import { getToken, saveSession } from "@/storage/trips";

export type Trip = Schemas["Trip"];
export type TripDetail = Schemas["TripDetail"];

const DAY = 24 * 60 * 60 * 1000;

async function persist({ trip, member, token }: Schemas["TripCreated"]) {
  await saveSession({
    tripId: trip.id,
    tripName: trip.name,
    joinCode: trip.joinCode,
    memberId: member.id,
    memberName: member.name,
    role: member.role,
    token,
  });
}

/** Crea un viaje que arranca hoy, dura `days` días y se revela al terminar. */
export async function createTrip(input: {
  name: string;
  adminName: string;
  days: number;
  timezone: string;
}): Promise<Trip> {
  const startsAt = Date.now();
  const endsAt = startsAt + input.days * DAY;

  const created = await unwrap(
    createApiClient({ baseUrl: API_URL }).POST("/trips", {
      body: {
        name: input.name.trim(),
        adminName: input.adminName.trim(),
        timezone: input.timezone,
        startsAt,
        endsAt,
        revealAt: endsAt,
      },
    }),
  );
  await persist(created);
  return created.trip;
}

export async function joinTrip(input: { code: string; name: string }): Promise<Trip> {
  const joined = await unwrap(
    createApiClient({ baseUrl: API_URL }).POST("/trips/join", {
      body: { code: input.code.trim().toUpperCase(), name: input.name.trim() },
    }),
  );
  await persist(joined);
  return joined.trip;
}

export async function fetchTrip(tripId: string): Promise<TripDetail> {
  const token = await getToken(tripId);
  if (!token) throw new Error("No estás en este viaje");

  return unwrap(
    createApiClient({ baseUrl: API_URL, token }).GET("/trips/{tripId}", { params: { path: { tripId } } }),
  );
}
