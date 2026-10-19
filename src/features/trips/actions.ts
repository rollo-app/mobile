import { createApiClient, unwrap, type Schemas } from "@/api/client";
import { API_URL } from "@/config";
import { getToken, saveSession, updateMemberName } from "@/storage/trips";

export type Trip = Schemas["Trip"];
export type TripDetail = Schemas["TripDetail"];
export type Feed = Schemas["Feed"];

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

/** Todo lo subido al viaje. Antes del revelado trae solo metadata (autor, hora, lugar, thumbhash). */
export async function fetchFeed(tripId: string): Promise<Schemas["Feed"]> {
  const token = await getToken(tripId);
  if (!token) throw new Error("No estás en este viaje");

  return unwrap(
    createApiClient({ baseUrl: API_URL, token }).GET("/trips/{tripId}/feed", { params: { path: { tripId } } }),
  );
}

/** Cambia tu nombre en el viaje: primero en el server, y si sale bien también en el celular. */
export async function renameMe(tripId: string, name: string): Promise<void> {
  const token = await getToken(tripId);
  if (!token) throw new Error("No estás en este viaje");

  const member = await unwrap(
    createApiClient({ baseUrl: API_URL, token }).PATCH("/trips/{tripId}/members/me", {
      params: { path: { tripId } },
      body: { name: name.trim() },
    }),
  );
  await updateMemberName(tripId, member.name);
}

/** Borra una foto o video del viaje (solo admin, antes del revelado). */
export async function deleteMedia(tripId: string, mediaId: string): Promise<void> {
  const token = await getToken(tripId);
  if (!token) throw new Error("No estás en este viaje");

  await unwrap(
    createApiClient({ baseUrl: API_URL, token }).DELETE("/media/{mediaId}", { params: { path: { mediaId } } }),
  );
}
