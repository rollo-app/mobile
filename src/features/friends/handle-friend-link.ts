import { queryClient } from "@/api/query-client";
import { setPendingFriend } from "@/storage/pending-friend";
import { claimFriendLink, redeemFriend } from "./actions";
import { parseFriendCode } from "./friend-link";
import { friendsKey } from "./use-friends";

/** The same message the server uses, so a malformed code and a dead one look alike. */
export const INVALID_LINK = "Código incorrecto o vencido";

/**
 * What opening a link did: with an account ready the friendship is made on the spot ("friends");
 * otherwise the permission is saved to be redeemed when the profile is complete ("pending").
 */
export type LinkOutcome = "friends" | "pending";

/** Opens a friend link (or a typed code). A new pending permission replaces the previous one. */
export async function openFriendLink(input: string, accountReady: boolean): Promise<LinkOutcome> {
  const code = parseFriendCode(input);
  if (!code) throw new Error(INVALID_LINK);

  const claim = await claimFriendLink(code);
  if (accountReady) {
    await redeemFriend({ claimToken: claim.claimToken });
    await queryClient.invalidateQueries({ queryKey: friendsKey });
    return "friends";
  }
  await setPendingFriend({ claimToken: claim.claimToken, creatorName: claim.creator.name });
  return "pending";
}

/** For the profile step: a code typed by hand is claimed now (so a wrong one shows up inline) and redeemed at the end. */
export async function stashFriendCode(input: string): Promise<void> {
  await openFriendLink(input, false);
}
