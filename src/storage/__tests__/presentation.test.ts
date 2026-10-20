import { hasSeenPresentation, markPresentationSeen } from "../presentation";

describe("presentation seen", () => {
  it("is not seen until marked", async () => {
    expect(await hasSeenPresentation("trip-1")).toBe(false);
  });

  it("is remembered per roll", async () => {
    await markPresentationSeen("trip-1");
    expect(await hasSeenPresentation("trip-1")).toBe(true);
    expect(await hasSeenPresentation("trip-2")).toBe(false);
  });
});
