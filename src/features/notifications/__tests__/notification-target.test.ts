import { notificationTarget } from "../notification-target";

const response = (data: unknown, identifier = "n1") =>
  ({ notification: { request: { identifier, content: { data } } } }) as never;

describe("notificationTarget", () => {
  it("opens a roll as the active one, on its tab", () => {
    expect(notificationTarget(response({ url: "/roll?trip=t1" }))).toEqual({ tripId: "t1", tab: true, href: "/roll" });
  });

  it("the reveal goes through the roll's tab, which plays it if it wasn't seen", () => {
    expect(notificationTarget(response({ url: "/reveal?trip=t1" }))).toEqual({ tripId: "t1", tab: true, href: "/roll" });
  });

  it("a profile is pushed as is, without touching the active roll", () => {
    expect(notificationTarget(response({ url: "/user/u2" }))).toEqual({ tripId: null, tab: false, href: "/user/u2" });
  });

  it("a photo keeps its tripId and makes that roll active", () => {
    expect(notificationTarget(response({ url: "/photo/m1?tripId=t1" }))).toEqual({
      tripId: "t1",
      tab: false,
      href: "/photo/m1?tripId=t1",
    });
  });

  it("drops the trip param from what it pushes but keeps the others", () => {
    expect(notificationTarget(response({ url: "/user/u2?trip=t1&x=1" }))).toEqual({ tripId: "t1", tab: false, href: "/user/u2?x=1" });
  });

  it("ignores anything that isn't an app path", () => {
    expect(notificationTarget(null)).toBeNull();
    expect(notificationTarget(response({}))).toBeNull();
    expect(notificationTarget(response({ url: 42 }))).toBeNull();
    expect(notificationTarget(response({ url: "https://evil.example/x" }))).toBeNull();
    expect(notificationTarget(response({ url: "//evil.example/x" }))).toBeNull();
    expect(notificationTarget(response(undefined))).toBeNull();
  });
});
