import { Linking, Share as NativeShare } from "react-native";
import Share from "react-native-share";
import { META_APP_ID } from "@/config";
import { instagramStoriesAvailable, isShareCancel, shareMore, shareToInstagramStories, writeStoryFile } from "../share-story";

describe("instagramStoriesAvailable", () => {
  it("is false without an app id and doesn't ask the system", async () => {
    const spy = jest.spyOn(Linking, "canOpenURL");
    expect(await instagramStoriesAvailable(null)).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("follows canOpenURL, and is false if it throws", async () => {
    const spy = jest.spyOn(Linking, "canOpenURL");
    spy.mockResolvedValueOnce(true);
    expect(await instagramStoriesAvailable("1")).toBe(true);
    expect(spy).toHaveBeenLastCalledWith("instagram-stories://share");
    spy.mockResolvedValueOnce(false);
    expect(await instagramStoriesAvailable("1")).toBe(false);
    spy.mockRejectedValueOnce(new Error("boom"));
    expect(await instagramStoriesAvailable("1")).toBe(false);
  });
});

describe("shareToInstagramStories", () => {
  it("opens the Stories editor with the image as background", async () => {
    await shareToInstagramStories("file:///cache/rollo-collage.jpg");
    expect(Share.shareSingle).toHaveBeenCalledWith({
      social: Share.Social.INSTAGRAM_STORIES,
      appId: "1187882687102371",
      backgroundImage: "file:///cache/rollo-collage.jpg",
    });
    expect(META_APP_ID).toBe("1187882687102371");
  });
});

describe("shareMore", () => {
  it("opens the system share sheet with the image and message", async () => {
    const spy = jest.spyOn(NativeShare, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
    await shareMore("file:///cache/rollo-invite.jpg", "Sumate");
    expect(spy).toHaveBeenCalledWith({ url: "file:///cache/rollo-invite.jpg", message: "Sumate" });
  });
});

describe("writeStoryFile", () => {
  it("returns the cache uri", async () => {
    expect(await writeStoryFile(new Uint8Array([1, 2]), "collage")).toBe("file:///cache/tmp");
  });
});

describe("isShareCancel", () => {
  it("is true only for the user cancelling", () => {
    expect(isShareCancel(new Error("User did not share"))).toBe(true);
    expect(isShareCancel(new Error("other"))).toBe(false);
    expect(isShareCancel("User did not share")).toBe(false);
    expect(isShareCancel(null)).toBe(false);
  });
});
