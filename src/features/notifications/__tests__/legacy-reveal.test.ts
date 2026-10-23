import * as Notifications from "expo-notifications";
import { cancelLegacyRevealNotifications } from "../legacy-reveal";

const notifications = jest.mocked(Notifications);

describe("cancelLegacyRevealNotifications", () => {
  it("cancels the local reveal notifications older builds scheduled (the push replaces them), and nothing else", async () => {
    notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "reveal.t1" },
      { identifier: "other" },
      { identifier: "reveal.t2" },
    ] as never);

    await cancelLegacyRevealNotifications();

    expect(notifications.cancelScheduledNotificationAsync.mock.calls).toEqual([["reveal.t1"], ["reveal.t2"]]);
  });

  it("never throws", async () => {
    notifications.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error("nope"));
    await expect(cancelLegacyRevealNotifications()).resolves.toBeUndefined();
  });
});
