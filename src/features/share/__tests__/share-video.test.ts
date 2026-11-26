import { Asset, requestPermissionsAsync } from "expo-media-library";
import { Linking } from "react-native";
import { PermissionDeniedError } from "@/features/gallery/save";
import { shareVideoToInstagram } from "../../../../modules/rollo-video";
import { instagramRoute, saveVideo, shareVideoToInstagramApp } from "../share-video";

jest.mock("../../../../modules/rollo-video", () => ({ shareVideoToInstagram: jest.fn(async () => true) }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
});

describe("instagramRoute", () => {
  it("takes every film up to 59 s straight to Stories; the library is only for a longer one", () => {
    expect(instagramRoute(19_000)).toBe("stories");
    expect(instagramRoute(41_000)).toBe("stories");
    expect(instagramRoute(59_000)).toBe("stories");
    expect(instagramRoute(59_001)).toBe("library");
  });
});

describe("shareVideoToInstagramApp", () => {
  it("sends a short film straight to Stories", async () => {
    await expect(shareVideoToInstagramApp("file:///v.mp4", 19_000)).resolves.toBe("stories");
    expect(shareVideoToInstagram).toHaveBeenCalledWith("stories", "file:///v.mp4", expect.any(String));
    expect(Asset.create).not.toHaveBeenCalled();
  });

  it("saves a long film and then opens Instagram", async () => {
    await expect(shareVideoToInstagramApp("file:///v.mp4", 60_000)).resolves.toBe("library");
    expect(Asset.create).toHaveBeenCalledWith("file:///v.mp4");
    expect(Linking.openURL).toHaveBeenCalledWith("instagram://story-camera");
    expect(shareVideoToInstagram).not.toHaveBeenCalled();
  });

  it("treats Instagram not opening as a failure", async () => {
    (shareVideoToInstagram as jest.Mock).mockResolvedValueOnce(false);
    await expect(shareVideoToInstagramApp("file:///v.mp4", 19_000)).rejects.toThrow();
  });

  it("rejects and opens nothing when Photos is denied", async () => {
    (requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false, canAskAgain: true });
    await expect(shareVideoToInstagramApp("file:///v.mp4", 60_000)).rejects.toBeInstanceOf(PermissionDeniedError);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});

describe("saveVideo", () => {
  it("asks for add-only permission", async () => {
    await saveVideo("file:///v.mp4");
    expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
  });
});
