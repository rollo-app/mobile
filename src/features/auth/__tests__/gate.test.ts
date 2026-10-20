import { gateFor } from "../gate";

const user = (name: string | null, username: string | null = "juani") => ({ id: "u1", email: "a@b.c", name, username, avatarUrl: null });

describe("gateFor", () => {
  it("waits while the session is being read", () => {
    expect(gateFor({ session: "loading", me: undefined, meFailed: false })).toBe("loading");
  });

  it("sends to the login when there is no session", () => {
    expect(gateFor({ session: "out", me: undefined, meFailed: false })).toBe("login");
  });

  it("waits for /me while it has no data", () => {
    expect(gateFor({ session: "in", me: undefined, meFailed: false })).toBe("loading");
  });

  it("shows an error if /me fails and there is nothing cached", () => {
    expect(gateFor({ session: "in", me: undefined, meFailed: true })).toBe("error");
  });

  it("asks to complete the profile when there is no name", () => {
    expect(gateFor({ session: "in", me: user(null), meFailed: false })).toBe("profile");
    expect(gateFor({ session: "in", me: user("  "), meFailed: false })).toBe("profile");
  });

  it("asks to complete the profile when there is a name but no username", () => {
    expect(gateFor({ session: "in", me: user("Juani", null), meFailed: false })).toBe("profile");
  });

  it("opens the app when signed in with a name", () => {
    expect(gateFor({ session: "in", me: user("Juani"), meFailed: false })).toBe("app");
  });

  it("keeps cached data when /me fails", () => {
    expect(gateFor({ session: "in", me: user("Juani"), meFailed: true })).toBe("app");
  });
});
