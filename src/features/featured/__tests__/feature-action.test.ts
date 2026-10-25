import { featureActionAvailable } from "../feature-action";

describe("featureActionAvailable", () => {
  it("is offered when you can feature the photo", () => {
    expect(featureActionAvailable({ featuredByMe: false, canFeature: true })).toBe(true);
  });

  it("is not offered when you can't (blocked by its author, their rollo setting, their account or a private rollo)", () => {
    expect(featureActionAvailable({ featuredByMe: false, canFeature: false })).toBe(false);
  });

  it("stays available to take it off your profile even if you can't add it anymore", () => {
    expect(featureActionAvailable({ featuredByMe: true, canFeature: false })).toBe(true);
  });
});
