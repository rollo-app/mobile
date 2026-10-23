import { createHash } from "crypto";
import { base64url, createLinkVerifier } from "../link-verifier";

describe("base64url", () => {
  it("encodes without padding and with the URL alphabet", () => {
    expect(base64url(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe("-__-");
    expect(base64url(new Uint8Array([0x61]))).toBe("YQ");
    expect(base64url(new Uint8Array([0x61, 0x62]))).toBe("YWI");
    expect(base64url(new Uint8Array([0x61, 0x62, 0x63]))).toBe("YWJj");
  });
});

describe("createLinkVerifier", () => {
  it("makes a 43-char random verifier and its SHA-256 challenge, both base64url", async () => {
    const { verifier, challenge } = await createLinkVerifier();

    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });

  it("is different every time", async () => {
    const a = await createLinkVerifier();
    const b = await createLinkVerifier();
    expect(a.verifier).not.toBe(b.verifier);
  });
});
