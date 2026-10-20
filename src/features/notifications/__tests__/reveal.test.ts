import * as Notifications from "expo-notifications";
import { requestRevealPermission, revealNotificationId, scheduleRevealNotification, tripIdFromResponse } from "../reveal";

const mocked = jest.mocked(Notifications);
const NOW = 1_800_000_000_000;
const trip = (over = {}) => ({ id: "t1", name: "Viaje al sur", revealAt: NOW + 1000, revealed: false, ...over });

beforeEach(() => jest.clearAllMocks());

describe("scheduleRevealNotification", () => {
  it("schedules a local notification for revealAt with a deterministic id", async () => {
    await scheduleRevealNotification(trip(), NOW);

    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: revealNotificationId("t1"),
      content: { title: "Se reveló Viaje al sur", body: "Entrá a ver las fotos de todos.", data: { tripId: "t1" } },
      trigger: { type: "date", date: NOW + 1000 },
    });
  });

  it("rescheduling uses the same id, so it replaces instead of duplicating", async () => {
    await scheduleRevealNotification(trip(), NOW);
    await scheduleRevealNotification(trip({ revealAt: NOW + 5000 }), NOW);

    const [first, second] = mocked.scheduleNotificationAsync.mock.calls.map(([r]) => r);
    expect(second!.identifier).toBe(first!.identifier);
    expect(second!.trigger).toEqual({ type: "date", date: NOW + 5000 });
  });

  it("cancels it when the roll is already revealed or the date has passed", async () => {
    await scheduleRevealNotification(trip({ revealed: true }), NOW);
    await scheduleRevealNotification(trip({ revealAt: NOW - 1 }), NOW);

    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith(revealNotificationId("t1"));
  });

  it("never throws if the native module fails", async () => {
    mocked.scheduleNotificationAsync.mockRejectedValueOnce(new Error("nope"));
    await expect(scheduleRevealNotification(trip(), NOW)).resolves.toBeUndefined();
  });
});

describe("requestRevealPermission", () => {
  it("asks when it hasn't been decided", async () => {
    await requestRevealPermission();
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask again if already granted or denied for good", async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true } as never);
    await requestRevealPermission();
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    await requestRevealPermission();
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe("tripIdFromResponse", () => {
  const response = (data: unknown, actionIdentifier = "expo.modules.notifications.actions.DEFAULT") =>
    ({ actionIdentifier, notification: { request: { content: { data } } } }) as never;

  it("reads the roll id from a tap on the notification", () => {
    expect(tripIdFromResponse(response({ tripId: "t1" }))).toBe("t1");
  });

  it("ignores empty responses and ones without a roll", () => {
    expect(tripIdFromResponse(null)).toBeNull();
    expect(tripIdFromResponse(response({}))).toBeNull();
  });
});
