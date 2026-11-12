import { createQueryClient, shouldDehydrateQuery } from "../query-client";
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

describe("shouldDehydrateQuery", () => {
  const client = createQueryClient();
  const query = (key: string[]) => {
    client.setQueryData(key, { ok: true });
    return client.getQueryCache().find({ queryKey: key })!;
  };

  it("saves ordinary queries but never the server's public config", () => {
    expect(shouldDehydrateQuery(query(["me"]))).toBe(true);
    expect(shouldDehydrateQuery(query(["config"]))).toBe(false);
  });
});
