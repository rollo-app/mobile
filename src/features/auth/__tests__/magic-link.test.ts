import { forgetMagicLinks, verifyMagicLinkOnce } from "../magic-link";

beforeEach(() => forgetMagicLinks());

describe("verifyMagicLinkOnce", () => {
  it("verifies a token only once, even if the link is opened twice", async () => {
    const verify = jest.fn(async () => ({ ok: true }));

    const [a, b] = await Promise.all([verifyMagicLinkOnce("a@b.c", "t1", verify), verifyMagicLinkOnce("a@b.c", "t1", verify)]);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith("a@b.c", "t1");
    expect(a).toBe(b);
  });

  it("a failed token keeps failing without asking again", async () => {
    const verify = jest.fn(async () => {
      throw new Error("El link venció");
    });

    await expect(verifyMagicLinkOnce("a@b.c", "t1", verify)).rejects.toThrow("El link venció");
    await expect(verifyMagicLinkOnce("a@b.c", "t1", verify)).rejects.toThrow("El link venció");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("a different token is verified on its own", async () => {
    const verify = jest.fn(async () => ({ ok: true }));

    await verifyMagicLinkOnce("a@b.c", "t1", verify);
    await verifyMagicLinkOnce("a@b.c", "t2", verify);

    expect(verify).toHaveBeenCalledTimes(2);
  });
});
