import { COMMENT_MAX_LENGTH, canSend, cleanDraft } from "../draft";

describe("comment draft", () => {
  it("trims what gets sent", () => {
    expect(cleanDraft("  jajaja  ")).toBe("jajaja");
  });

  it("can't send blank text", () => {
    expect(canSend("")).toBe(false);
    expect(canSend("  \n ")).toBe(false);
    expect(canSend("hola")).toBe(true);
  });

  it("allows up to 500 characters after trimming", () => {
    expect(COMMENT_MAX_LENGTH).toBe(500);
    expect(canSend("a".repeat(500))).toBe(true);
    expect(canSend(`  ${"a".repeat(500)}  `)).toBe(true);
    expect(canSend("a".repeat(501))).toBe(false);
  });
});
