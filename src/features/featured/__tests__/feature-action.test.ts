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

  it("is never offered for a daily-moment photo", () => {
    expect(featureActionAvailable({ featuredByMe: false, canFeature: true, momentDay: "2027-01-12" })).toBe(false);
  });

  it("still lets you take a moment photo off your profile if it was already there", () => {
    expect(featureActionAvailable({ featuredByMe: true, canFeature: false, momentDay: "2027-01-12" })).toBe(true);
  });

  it("is never offered for an archived photo", () => {
    expect(featureActionAvailable({ featuredByMe: false, canFeature: true, archived: true })).toBe(false);
    expect(featureActionAvailable({ featuredByMe: true, canFeature: true, archived: true })).toBe(false);
  });
});
