import { ApiError } from "@/api/client";
import { INVALID_LINK } from "../handle-friend-link";
import { friendLinkFailure } from "../friend-link-failure";

describe("friendLinkFailure", () => {
  it.each([400, 404])("treats a %s from the server as an expired link", (status) => {
    expect(friendLinkFailure(new ApiError(status, "x"))).toBe("expired");
  });

  it("treats an unparseable code as an expired link", () => {
    expect(friendLinkFailure(new Error(INVALID_LINK))).toBe("expired");
  });

  it.each([0, 429, 500, 503])("treats a %s as unavailable", (status) => {
    expect(friendLinkFailure(new ApiError(status, "x"))).toBe("unavailable");
  });

  it("treats unknown errors as unavailable", () => {
    expect(friendLinkFailure(new Error("boom"))).toBe("unavailable");
    expect(friendLinkFailure("nope")).toBe("unavailable");
  });
});
