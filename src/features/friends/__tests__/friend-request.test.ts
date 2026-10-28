import { friendRequestUi } from "../friend-request";

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
