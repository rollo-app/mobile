import { friendLinkPath, friendLinkUrl, parseFriendCode } from "../friend-link";

describe("friendLinkUrl", () => {
  it("builds the app link for a code", () => {
    expect(friendLinkUrl("K7M2QX9A")).toBe("https://rollo.juanifraga.com/friends#K7M2QX9A");
  });
});

describe("parseFriendCode", () => {
  it("accepts the full link, ignoring case, spaces and dashes", () => {
    expect(parseFriendCode("rollo://friends/k7m2-qx9a")).toBe("K7M2QX9A");
  });

  it("accepts a bare code", () => {
    expect(parseFriendCode(" k7m2 qx9a ")).toBe("K7M2QX9A");
  });

  it("returns null when it is not 8 valid characters", () => {
    expect(parseFriendCode("hola")).toBeNull();
    expect(parseFriendCode("K7M2QX9")).toBeNull();
    expect(parseFriendCode("K7M2QX9AB")).toBeNull();
    expect(parseFriendCode("")).toBeNull();
  });
});

describe("https friend links", () => {
  it("parseFriendCode accepts the https form and the old scheme form", () => {
    expect(parseFriendCode("https://rollo.juanifraga.com/friends#k7m2qx9a")).toBe("K7M2QX9A");
    expect(parseFriendCode("https://ROLLO.juanifraga.com/friends/#K7M2-QX9A")).toBe("K7M2QX9A");
    expect(parseFriendCode("rollo://friends/K7M2QX9A")).toBe("K7M2QX9A");
    expect(parseFriendCode("https://rollo.juanifraga.com/friends#hola")).toBeNull();
    expect(parseFriendCode("https://rollo.juanifraga.com/friends")).toBeNull();
  });

  it("friendLinkPath maps a friend link to its route", () => {
    expect(friendLinkPath("https://rollo.juanifraga.com/friends#K7M2QX9A")).toBe("/friends/K7M2QX9A");
    expect(friendLinkPath("https://rollo.juanifraga.com/friends/?x=1#k7m2qx9a")).toBe("/friends/K7M2QX9A");
  });

  it("friendLinkPath routes a missing or bad code to one the screen reports as invalid", () => {
    expect(friendLinkPath("https://rollo.juanifraga.com/friends")).toBe("/friends/invalid");
    expect(friendLinkPath("https://rollo.juanifraga.com/friends#nope")).toBe("/friends/invalid");
  });

  it("friendLinkPath returns null for anything else", () => {
    expect(friendLinkPath("https://rollo.juanifraga.com/soporte")).toBeNull();
    expect(friendLinkPath("rollo://friends/K7M2QX9A")).toBeNull();
    expect(friendLinkPath("https://example.com/friends#K7M2QX9A")).toBeNull();
  });
});
