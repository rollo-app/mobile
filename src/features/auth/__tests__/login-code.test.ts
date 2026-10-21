import { LOGIN_CODE_LENGTH, normalizeLoginCode } from "../login-code";

describe("normalizeLoginCode", () => {
  it("uppercases what you type", () => {
    expect(normalizeLoginCode("k7m4qx")).toBe("K7M4QX");
  });

  it("drops spaces, dashes and characters outside the alphabet", () => {
    expect(normalizeLoginCode("k7m-4 qx")).toBe("K7M4QX");
    expect(normalizeLoginCode("0O1IL")).toBe("");
  });

  it("keeps at most 6 characters", () => {
    expect(normalizeLoginCode("ABCDEFGH")).toBe("ABCDEF");
    expect(LOGIN_CODE_LENGTH).toBe(6);
  });

  it("accepts digits 2-9", () => {
    expect(normalizeLoginCode("234567")).toBe("234567");
  });
});
