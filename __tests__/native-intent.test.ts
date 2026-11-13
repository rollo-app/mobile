import { redirectSystemPath } from "../app/+native-intent";

const go = (path: string) => redirectSystemPath({ path, initial: true });

describe("redirectSystemPath", () => {
  it("maps the https magic link to /login", () => {
    expect(go("https://rolloproject.com/login#t=abc&e=a%40b.com")).toBe("/login?token=abc&email=a%40b.com");
  });

  it("maps the https friend link to /friends/<CODE>", () => {
    expect(go("https://rolloproject.com/friends#k7m2qx9a")).toBe("/friends/K7M2QX9A");
  });

  it("sends a friend link without a valid code to a code the screen reports as dead", () => {
    expect(go("https://rolloproject.com/friends")).toBe("/friends/invalid");
  });

  it("maps the https and rollo:// join links to /join?code=<CODE>", () => {
    expect(go("https://rolloproject.com/join/abc123")).toBe("/join?code=ABC123");
    expect(go("rollo://join/ABC123")).toBe("/join?code=ABC123");
  });

  it("leaves everything else unchanged", () => {
    for (const path of [
      "rollo://login?token=a&email=b",
      "rollo://friends/K7M2QX9A",
      "https://rolloproject.com/support",
      "/some/dev-client/path",
    ]) {
      expect(go(path)).toBe(path);
    }
  });
});
