import { ApiError } from "@/api/client";
import { getPendingFriend, setPendingFriend } from "@/storage/pending-friend";
import { redeemFriend } from "@/features/friends/actions";
import { redeemPendingFriend } from "../use-pending-friend";

jest.mock("@/features/friends/actions", () => ({ redeemFriend: jest.fn() }));

const redeem = redeemFriend as jest.Mock;

describe("redeemPendingFriend", () => {
  beforeEach(async () => {
    redeem.mockReset();
    await setPendingFriend({ claimToken: "tok", creatorName: "Lu" });
  });

  it("keeps the pending friend code on a 428", async () => {
    redeem.mockRejectedValue(new ApiError(428, "Completá tu perfil"));

    await redeemPendingFriend();

    expect(await getPendingFriend()).toEqual({ claimToken: "tok", creatorName: "Lu" });
  });

  it("drops the pending friend code on a rejection", async () => {
    redeem.mockRejectedValue(new ApiError(404, "No existe"));

    await redeemPendingFriend();

    expect(await getPendingFriend()).toBeNull();
  });
});
