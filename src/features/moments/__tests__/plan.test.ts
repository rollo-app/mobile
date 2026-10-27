import { MAX_SCHEDULED, momentNotificationId, planMoments, type TripMoments } from "../plan";

const now = Date.UTC(2027, 0, 10, 12);

describe("planMoments", () => {
  const t = (tripId: string, times: number[]): TripMoments => ({
    tripId,
    tripName: tripId.toUpperCase(),
    moments: times.map((notifyAt, i) => ({ day: `d${i}`, notifyAt })),
  });

  it("drops past moments and sorts two mixed rollos by time", () => {
    const planned = planMoments([t("a", [now - 1, now + 30, now + 10]), t("b", [now + 20])], now);
    expect(planned.map((p) => [p.tripId, p.notifyAt])).toEqual([
      ["a", now + 10],
      ["b", now + 20],
      ["a", now + 30],
    ]);
    expect(planned[0]).toMatchObject({ id: momentNotificationId("a", "d2"), tripName: "A", day: "d2" });
  });

  it("keeps only the first 40", () => {
    const times = Array.from({ length: 50 }, (_, i) => now + 50 - i);
    const planned = planMoments([t("a", times)], now);
    expect(planned).toHaveLength(MAX_SCHEDULED);
    expect(planned[0]!.notifyAt).toBe(now + 1);
  });
});

it("builds the notification id", () => {
  expect(momentNotificationId("t1", "2027-01-12")).toBe("moment.t1.2027-01-12");
});
