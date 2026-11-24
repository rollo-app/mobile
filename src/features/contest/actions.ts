import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";

export type Contest = Schemas["Contest"];
export type ContestFinalist = Schemas["ContestFinalist"];

/** The event's contest: status, finalists, your vote and the winner. 404 "Este evento no tiene concurso." if there is none. */
export async function fetchContest(tripId: string): Promise<Contest> {
  return unwrap((await authedClient()).GET("/trips/{tripId}/contest", { params: { path: { tripId } } }));
}

/** Marks a photo as a finalist (organizers, between the end and the reveal; 409 past 10). */
export async function putFinalist(tripId: string, mediaId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/trips/{tripId}/contest/finalists/{mediaId}", { params: { path: { tripId, mediaId } } }));
}

/** Unmarks a finalist. */
export async function deleteFinalist(tripId: string, mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}/contest/finalists/{mediaId}", { params: { path: { tripId, mediaId } } }));
}
