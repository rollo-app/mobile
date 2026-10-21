import { friendLinkUrl, parseFriendCode } from "../friend-link";

describe("friendLinkUrl", () => {
  it("builds the app link for a code", () => {
    expect(friendLinkUrl("K7M2QX9A")).toBe("rollo://amigos/K7M2QX9A");
  });
});

describe("parseFriendCode", () => {
  it("accepts the full link, ignoring case, spaces and dashes", () => {
    expect(parseFriendCode("rollo://amigos/k7m2-qx9a")).toBe("K7M2QX9A");
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
