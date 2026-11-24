import { unwrap, type Schemas } from "@/api/client";
import { authedClient } from "@/features/auth/session";

export type Contest = Schemas["Contest"];
export type ContestFinalist = Schemas["ContestFinalist"];

/** The event's contest: status, finalists, your vote and the winner. 404 "Este evento no tiene concurso." if there is none. */
export async function fetchContest(tripId: string): Promise<Contest> {
  return unwrap((await authedClient()).GET("/trips/{tripId}/contest", { params: { path: { tripId } } }));
}

/** Marks a photo as a finalist (organizers, between the end and the reveal; 409 outside the window). */
export async function putFinalist(tripId: string, mediaId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/trips/{tripId}/contest/finalists/{mediaId}", { params: { path: { tripId, mediaId } } }));
}

/** Unmarks a finalist. */
export async function deleteFinalist(tripId: string, mediaId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}/contest/finalists/{mediaId}", { params: { path: { tripId, mediaId } } }));
}

/** Votes for a finalist (members, while voting; 400 your own photo, 409 "La votación no está abierta."). Changing it is the same call. */
export async function putVote(tripId: string, mediaId: string): Promise<void> {
  await unwrap((await authedClient()).PUT("/trips/{tripId}/contest/vote", { params: { path: { tripId } }, body: { mediaId } }));
}

/** Takes your vote back. */
export async function deleteVote(tripId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}/contest/vote", { params: { path: { tripId } } }));
}

/** Breaks a tie (organizers, while `tied`). */
export async function putWinner(tripId: string, mediaId: string): Promise<void> {
  await unwrap((await authedClient()).POST("/trips/{tripId}/contest/winner", { params: { path: { tripId } }, body: { mediaId } }));
}
