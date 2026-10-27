import { formatFriendCount } from "../friend-count";

describe("formatFriendCount", () => {
  it("is singular for one friend and plural otherwise", () => {
    expect(formatFriendCount(1)).toBe("1 amigo");
    expect(formatFriendCount(12)).toBe("12 amigos");
  });

  it("separates thousands with a dot", () => {
    expect(formatFriendCount(1284)).toBe("1.284 amigos");
    expect(formatFriendCount(1284, 1000)).toBe("1.284 amigos · 1.000 en común");
    expect(formatFriendCount(1234567)).toBe("1.234.567 amigos");
    expect(formatFriendCount(999)).toBe("999 amigos");
  });

  it("adds the friends in common when there are any", () => {
    expect(formatFriendCount(12, 3)).toBe("12 amigos · 3 en común");
    expect(formatFriendCount(1, 1)).toBe("1 amigo · 1 en común");
    expect(formatFriendCount(12, 0)).toBe("12 amigos");
  });

  it("shows nothing when the person has no friends", () => {
    expect(formatFriendCount(0)).toBeNull();
    expect(formatFriendCount(0, 0, true)).toBeNull();
    expect(formatFriendCount(0, 0, false)).toBeNull();
  });

  it("shows nothing when the list is hidden and there are no friends in common", () => {
    expect(formatFriendCount(12, 0, false)).toBeNull();
  });

  it("still shows the count when the list is hidden but there are friends in common", () => {
    expect(formatFriendCount(12, 3, false)).toBe("12 amigos · 3 en común");
  });

  it("shows the count when the list is visible", () => {
    expect(formatFriendCount(12, 0, true)).toBe("12 amigos");
  });
});
