import { createQueryClient } from "../query-client";

describe("createQueryClient", () => {
  it("runs mutations without waiting for the network and without retrying", () => {
    const mutations = createQueryClient().getDefaultOptions().mutations;
    expect(mutations).toEqual(expect.objectContaining({ networkMode: "always", retry: 0 }));
  });
});
