import { ApiError } from "@/api/client";
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

  it("a token the server rejected keeps failing without asking again", async () => {
    const verify = jest.fn(async () => {
      throw new ApiError(400, "El link venció");
    });

    await expect(verifyMagicLinkOnce("a@b.c", "t1", verify)).rejects.toThrow("El link venció");
    await expect(verifyMagicLinkOnce("a@b.c", "t1", verify)).rejects.toThrow("El link venció");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("a failure that isn't the server's answer (offline) can be retried", async () => {
    const verify = jest.fn().mockRejectedValueOnce(new ApiError(0, "Sin conexión")).mockResolvedValueOnce({ ok: true });

    await expect(verifyMagicLinkOnce("a@b.c", "t1", verify)).rejects.toThrow("Sin conexión");
    await expect(verifyMagicLinkOnce("a@b.c", "t1", verify)).resolves.toEqual({ ok: true });
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("once it signed in, the same link is checked again (after a logout it has to fail on its own)", async () => {
    const verify = jest.fn(async () => ({ ok: true }));

    await verifyMagicLinkOnce("a@b.c", "t1", verify);
    await verifyMagicLinkOnce("a@b.c", "t1", verify);

    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("the same token for another email is a different link", async () => {
    const verify = jest.fn(async () => ({ ok: true }));
    let finish!: () => void;
    verify.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve({ ok: true }))));

    const first = verifyMagicLinkOnce("a@b.c", "t1", verify);
    await verifyMagicLinkOnce("x@y.z", "t1", verify);
    finish();
    await first;

    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("a different token is verified on its own", async () => {
    const verify = jest.fn(async () => ({ ok: true }));

    await verifyMagicLinkOnce("a@b.c", "t1", verify);
    await verifyMagicLinkOnce("a@b.c", "t2", verify);

    expect(verify).toHaveBeenCalledTimes(2);
  });
});
