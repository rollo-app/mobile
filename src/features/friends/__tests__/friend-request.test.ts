import { afterSearchAction, friendRequestUi } from "../friend-request";

describe("friendRequestUi", () => {
  it("no button for friends, yourself or a blocked person", () => {
    expect(friendRequestUi({ isFriend: true, isMe: false, blockedByMe: false, friendRequest: "none" })).toBeNull();
    expect(friendRequestUi({ isFriend: false, isMe: true, blockedByMe: false, friendRequest: "none" })).toBeNull();
    expect(friendRequestUi({ isFriend: false, isMe: false, blockedByMe: true, friendRequest: "none" })).toBeNull();
  });

  it("maps the server state to what the button shows", () => {
    const base = { isFriend: false, isMe: false, blockedByMe: false };
    expect(friendRequestUi({ ...base, friendRequest: "none" })).toBe("add");
    expect(friendRequestUi({ ...base, friendRequest: "sent" })).toBe("sent");
    expect(friendRequestUi({ ...base, friendRequest: "received" })).toBe("received");
  });
});

describe("afterSearchAction", () => {
  const row = (id: string, friendRequest: "none" | "sent" | "received") => ({ id, name: id, username: id, avatarUrl: null, mutualCount: 0, friendRequest });
  const rows = [row("a", "none"), row("b", "sent"), row("c", "received")];

  it("send marks the row as sent", () => {
    expect(afterSearchAction(rows, "a", "send").map((r) => r.friendRequest)).toEqual(["sent", "sent", "received"]);
  });

  it("cancel and reject put the row back to none", () => {
    expect(afterSearchAction(rows, "b", "cancel")[1]?.friendRequest).toBe("none");
    expect(afterSearchAction(rows, "c", "reject")[2]?.friendRequest).toBe("none");
  });

  it("accept removes the person from the results", () => {
    expect(afterSearchAction(rows, "c", "accept").map((r) => r.id)).toEqual(["a", "b"]);
  });
});
