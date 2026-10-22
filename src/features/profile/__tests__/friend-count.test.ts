import { formatFriendCount } from "../friend-count";

describe("formatFriendCount", () => {
  it("is singular for one friend and plural otherwise", () => {
    expect(formatFriendCount(1)).toBe("1 amigo");
    expect(formatFriendCount(0)).toBe("0 amigos");
    expect(formatFriendCount(12)).toBe("12 amigos");
  });

  it("adds the friends in common when there are any", () => {
    expect(formatFriendCount(12, 3)).toBe("12 amigos · 3 en común");
    expect(formatFriendCount(1, 1)).toBe("1 amigo · 1 en común");
    expect(formatFriendCount(12, 0)).toBe("12 amigos");
  });
});
