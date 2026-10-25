import type { UserProfile } from "@/features/profile/actions";

export type FriendRequestUi = "add" | "sent" | "received";

/** What the request button on someone's profile shows; `null` when there is none (a friend, yourself, a blocked person). */
export function friendRequestUi(p: { isFriend: boolean; isMe: boolean; blockedByMe: boolean; friendRequest: UserProfile["friendRequest"] }): FriendRequestUi | null {
  if (p.isFriend || p.isMe || p.blockedByMe) return null;
  return p.friendRequest === "none" ? "add" : p.friendRequest;
}

/** The profile as it will be once the server accepts the action, so the button changes at once. */
export function afterAction(profile: UserProfile, action: "send" | "cancel" | "accept" | "reject"): UserProfile {
  switch (action) {
    case "send":
      return { ...profile, friendRequest: "sent" };
    case "accept":
      return { ...profile, friendRequest: "none", isFriend: true };
    default:
      return { ...profile, friendRequest: "none" };
  }
}
