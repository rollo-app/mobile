import { ownStats } from "../own-stats";

describe("ownStats", () => {
  it("shows nothing while the friend list loads", () => {
    expect(ownStats({ friends: undefined, profile: null, profileFailed: false, featuredLength: undefined })).toBeUndefined();
  });

  it("waits for the profile before saying Todavía no tenés amigos", () => {
    expect(ownStats({ friends: 0, profile: null, profileFailed: false, featuredLength: undefined })).toBeUndefined();
  });

  it("falls back to Todavía no tenés amigos when the profile fails", () => {
    expect(ownStats({ friends: 0, profile: null, profileFailed: true, featuredLength: undefined })).toEqual({ friends: 0, own: true });
  });

  it("shows friends only while the profile loads", () => {
    expect(ownStats({ friends: 4, profile: null, profileFailed: false, featuredLength: undefined })).toEqual({ friends: 4, own: true });
  });

  it("prefers the loaded featured list over featuredCount", () => {
    expect(ownStats({ friends: 4, profile: { rollCount: 2, featuredCount: 10 }, featuredLength: 11, profileFailed: false })).toEqual({ rolls: 2, photos: 11, friends: 4, own: true });
  });

  it("falls back to featuredCount before the grid loads", () => {
    expect(ownStats({ friends: 4, profile: { rollCount: 2, featuredCount: 10 }, profileFailed: false, featuredLength: undefined })).toEqual({ rolls: 2, photos: 10, friends: 4, own: true });
  });
});
