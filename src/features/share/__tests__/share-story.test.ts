import { Linking, Share as NativeShare } from "react-native";
import { File } from "expo-file-system";
import Share from "react-native-share";
import { META_APP_ID } from "@/config";
import { instagramStoriesAvailable, isShareCancel, shareMore, shareToInstagramStories, writeShareFile } from "../share-story";

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
  const input = { stickerUri: "file:///cache/rollo-collage-card.png", backgroundVideoUri: "file:///assets/bg-dark.mp4", backgroundColor: "#0b0b0c" };

  it("opens the Stories editor with the card as sticker over the background video", async () => {
    await shareToInstagramStories(input);
    expect(Share.shareSingle).toHaveBeenCalledWith({
      social: Share.Social.INSTAGRAM_STORIES,
      appId: "1187882687102371",
      stickerImage: "file:///cache/rollo-collage-card.png",
      backgroundVideo: "file:///assets/bg-dark.mp4",
      backgroundTopColor: "#0b0b0c",
      backgroundBottomColor: "#0b0b0c",
    });
    expect(Share.shareSingle).toHaveBeenLastCalledWith(expect.not.objectContaining({ backgroundImage: expect.anything() }));
    expect(META_APP_ID).toBe("1187882687102371");
  });

  it("sends the link as linkText when given", async () => {
    await shareToInstagramStories({ ...input, linkText: "https://rolloproject.com/j/HUB5FT" });
    expect(Share.shareSingle).toHaveBeenLastCalledWith(expect.objectContaining({ linkText: "https://rolloproject.com/j/HUB5FT" }));
  });

  it("has no linkText key without a link", async () => {
    await shareToInstagramStories(input);
    expect(Share.shareSingle).toHaveBeenLastCalledWith(expect.not.objectContaining({ linkText: expect.anything() }));
  });
});

describe("shareMore", () => {
  it("opens the system share sheet with the image and message", async () => {
    const spy = jest.spyOn(NativeShare, "share").mockResolvedValue({ action: "sharedAction", activityType: undefined });
    await shareMore("file:///cache/rollo-invite.jpg", "Sumate");
    expect(spy).toHaveBeenCalledWith({ url: "file:///cache/rollo-invite.jpg", message: "Sumate" });
  });
});

describe("writeShareFile", () => {
  it("returns the cache uri", async () => {
    expect(await writeShareFile(new Uint8Array([1, 2]), "rollo-collage-card.png")).toBe("file:///cache/tmp");
  });

  it("writes the given name in the cache, overwriting the previous one", async () => {
    const create = jest.spyOn(File.prototype, "create");
    const write = jest.spyOn(File.prototype, "write");
    const bytes = new Uint8Array([1, 2]);
    await writeShareFile(bytes, "rollo-invite-still.jpg");
    expect((File as unknown as { lastParts: unknown[] }).lastParts).toEqual(["file:///cache/", "rollo-invite-still.jpg"]);
    expect(create).toHaveBeenCalledWith({ overwrite: true });
    expect(write).toHaveBeenCalledWith(bytes);
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
