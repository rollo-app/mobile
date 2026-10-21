import { clearPendingFriend, getPendingFriend, setPendingFriend } from "../pending-friend";

describe("pending friend", () => {
  it("is null until one is saved", async () => {
    expect(await getPendingFriend()).toBeNull();
  });

  it("saves, reads and clears it", async () => {
    await setPendingFriend({ claimToken: "tok", creatorName: "Cami" });
    expect(await getPendingFriend()).toEqual({ claimToken: "tok", creatorName: "Cami" });

    await clearPendingFriend();
    expect(await getPendingFriend()).toBeNull();
  });

  it("uses the rollo.pendingFriend key", async () => {
    await setPendingFriend({ claimToken: "tok", creatorName: "Cami" });
    expect(require("expo-secure-store").__store.has("rollo.pendingFriend")).toBe(true);
  });

  it("ignores a corrupt value", async () => {
    require("expo-secure-store").__store.set("rollo.pendingFriend", "{nope");
    expect(await getPendingFriend()).toBeNull();
  });
});
