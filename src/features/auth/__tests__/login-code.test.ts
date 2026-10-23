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

  describe("pasted or autofilled text", () => {
    it("trims spaces and dashes around a lowercase code", () => {
      expect(normalizeLoginCode(" k7m-4qx ")).toBe("K7M4QX");
    });

    it("picks the code out of a sentence", () => {
      expect(normalizeLoginCode("Tu código de Rollo es K7M4QX")).toBe("K7M4QX");
      expect(normalizeLoginCode("tu código de rollo es k7m4qx.")).toBe("K7M4QX");
    });

    it("keeps one code when it comes twice", () => {
      expect(normalizeLoginCode("K7M4QXK7M4QX")).toBe("K7M4QX");
      expect(normalizeLoginCode("K7M4QX K7M4QX")).toBe("K7M4QX");
    });

    it("prefers a standalone 6-character token over the first valid characters", () => {
      expect(normalizeLoginCode("Rollo: 23ABCD")).toBe("23ABCD");
    });
  });

  describe("inserting into a field that already has a code", () => {
    it("takes the inserted code, not the old one", () => {
      expect(normalizeLoginCode("OLD234NEW456", "OLD234")).toBe("NEW456");
      expect(normalizeLoginCode("K7M4QX A2B3C4", "K7M4QX")).toBe("A2B3C4");
    });

    it("still types one character at a time", () => {
      expect(normalizeLoginCode("K7M4", "K7M")).toBe("K7M4");
    });
  });

  it("prefers a token with digits, and the last one, over plain words", () => {
    expect(normalizeLoginCode("Para ENTRAR usá K7M4QX")).toBe("K7M4QX");
    expect(normalizeLoginCode("Para ENTRAR usá ABCDEF")).toBe("ABCDEF");
  });
});

