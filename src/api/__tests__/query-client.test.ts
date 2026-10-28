import { createQueryClient } from "../query-client";
import { ApiError } from "../client";

describe("createQueryClient", () => {
  it("runs mutations without waiting for the network and without retrying", () => {
    const mutations = createQueryClient().getDefaultOptions().mutations;
    expect(mutations).toEqual(expect.objectContaining({ networkMode: "always", retry: 0 }));
  });
});

describe("query retry", () => {
  const retry = createQueryClient().getDefaultOptions().queries!.retry as (count: number, error: Error) => boolean;

  it("retries a network error or a 5xx once", () => {
    expect(retry(0, new ApiError(0, "offline"))).toBe(true);
    expect(retry(0, new ApiError(503, "down"))).toBe(true);
    expect(retry(0, new TypeError("Network request failed"))).toBe(true);
    expect(retry(1, new ApiError(503, "down"))).toBe(false);
  });

  it("never retries a 4xx: the same request would fail the same way", () => {
    for (const status of [400, 401, 403, 404, 409, 429]) expect(retry(0, new ApiError(status, "no"))).toBe(false);
  });
});
