import { createApiClient, unwrap, type Schemas } from "@/api/client";
import { API_URL } from "@/config";
import { authedClient } from "@/features/auth/session";

export type Friend = Schemas["Friend"];
export type FriendLink = Schemas["FriendLink"];
export type CommonTrip = Schemas["CommonTrip"];
export type FriendClaim = Schemas["ClaimResponse"];
export type AddMemberResult = Schemas["AddMembersResponse"]["results"][number];

/** A link for friends to open; it lasts an hour and replaces the previous one. */
export async function createFriendLink(): Promise<FriendLink> {
  return unwrap((await authedClient()).POST("/friends/link"));
}

/** Opens a link without a session: if it's alive, returns who made it and a permission to redeem it later. */
export async function claimFriendLink(code: string): Promise<FriendClaim> {
  return unwrap(createApiClient({ baseUrl: API_URL }).POST("/friend-links/claim", { body: { code } }));
}

/**
 * Becomes friends with whoever made the link (a code, or a claim token from `claimFriendLink`).
 * Redeeming your own link answers with yourself and creates nothing.
 */
export async function redeemFriend(input: { code: string } | { claimToken: string }): Promise<Friend> {
  const { friend } = await unwrap((await authedClient()).POST("/friends/redeem", { body: input }));
  return friend;
}

export async function fetchFriends(): Promise<Friend[]> {
  return (await unwrap((await authedClient()).GET("/friends"))).friends;
}

/** A friend and the rolls you're both active members in. 404 if you aren't friends. */
export async function fetchFriend(userId: string): Promise<{ friend: Friend; commonTrips: CommonTrip[] }> {
  return unwrap((await authedClient()).GET("/friends/{userId}", { params: { path: { userId } } }));
}

export async function removeFriend(userId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/friends/{userId}", { params: { path: { userId } } }));
}

/** Adds friends to a trip directly; the answer is per friend, never all-or-nothing. */
export async function addFriendsToTrip(tripId: string, friendIds: string[]): Promise<AddMemberResult[]> {
  const { results } = await unwrap(
    (await authedClient()).POST("/trips/{tripId}/members", { params: { path: { tripId } }, body: { friendIds } }),
  );
  return results;
}

/** Leaves the trip (your photos stay in it). The admin can't. */
export async function leaveTrip(tripId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/trips/{tripId}/members/me", { params: { path: { tripId } } }));
}

export type FriendRequest = Schemas["ReceivedFriendRequest"];

/**
 * Asks to be friends with someone whose profile you opened. `friends` when they had asked you too (or you
 * already were): the friendship exists right away; `sent` otherwise.
 */
export async function sendFriendRequest(userId: string): Promise<"sent" | "friends"> {
  const { status } = await unwrap((await authedClient()).POST("/users/{userId}/friend-request", { params: { path: { userId } } }));
  return status;
}

/** Takes back a request you sent (also fine if there was none). */
export async function cancelFriendRequest(userId: string): Promise<void> {
  await unwrap((await authedClient()).DELETE("/users/{userId}/friend-request", { params: { path: { userId } } }));
}

/** Requests people sent you that are still waiting for an answer, newest first. */
export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  return (await unwrap((await authedClient()).GET("/me/friend-requests"))).requests;
}

export async function acceptFriendRequest(userId: string): Promise<Friend> {
  const { friend } = await unwrap((await authedClient()).POST("/me/friend-requests/{userId}/accept", { params: { path: { userId } } }));
  return friend;
}

/** Silent: they aren't told. */
export async function rejectFriendRequest(userId: string): Promise<void> {
  await unwrap((await authedClient()).POST("/me/friend-requests/{userId}/reject", { params: { path: { userId } } }));
}
