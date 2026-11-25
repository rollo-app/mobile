import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { pickCoverPhoto } from "../use-upload-cover";
import { cropRequestOptions } from "@/features/crop/crop-request";

jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/features/trips/actions", () => ({ uploadCover: jest.fn() }));

describe("pickCoverPhoto", () => {
  it("opens the crop asking for the portrait 3:4 shape at 1080 px wide", async () => {
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///a.jpg", width: 4000, height: 3000 }] } as never);
    void pickCoverPhoto();
    await new Promise((r) => setImmediate(r));
    const { params } = jest.mocked(router.push).mock.calls[0]![0] as unknown as { params: { id: string } };
    expect(cropRequestOptions(params.id)).toEqual({ shape: "portrait", size: 1080 });
  });
});
