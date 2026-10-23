import * as Notifications from "expo-notifications";
import { markPushPrimerSeen } from "@/storage/push-primer";
import { pushPermission, shouldOfferPushPrimer } from "../push-permission";

const notifications = jest.mocked(Notifications);
const permission = (granted: boolean, canAskAgain: boolean, status: string) =>
  notifications.getPermissionsAsync.mockResolvedValue({ granted, canAskAgain, status } as never);

afterEach(() => permission(false, true, "undetermined"));

describe("pushPermission", () => {
  it("tells granted, denied and never asked apart", async () => {
    permission(true, true, "granted");
    expect(await pushPermission()).toBe("granted");
    permission(false, false, "denied");
    expect(await pushPermission()).toBe("denied");
    permission(false, true, "undetermined");
    expect(await pushPermission()).toBe("undetermined");
  });

  it("if the native module fails it counts as denied (nothing is asked)", async () => {
    notifications.getPermissionsAsync.mockRejectedValueOnce(new Error("nope"));
    expect(await pushPermission()).toBe("denied");
  });
});

describe("shouldOfferPushPrimer", () => {
  it("only when the permission was never asked and the primer wasn't shown", async () => {
    expect(await shouldOfferPushPrimer()).toBe(true);
    permission(true, true, "granted");
    expect(await shouldOfferPushPrimer()).toBe(false);
    permission(false, false, "denied");
    expect(await shouldOfferPushPrimer()).toBe(false);
    permission(false, true, "undetermined");
    await markPushPrimerSeen();
    expect(await shouldOfferPushPrimer()).toBe(false);
  });
});
