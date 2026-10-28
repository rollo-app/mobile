import { act, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import type { RevealedPhoto } from "@/features/media/revealed";
import { PermissionDeniedError } from "../save";
import { savedTarget, useSavePhoto } from "../use-save-photo";

jest.mock("expo-haptics", () => ({ notificationAsync: jest.fn(async () => {}), NotificationFeedbackType: { Success: "success" } }));

const photo = { id: "p1" } as RevealedPhoto;

describe("useSavePhoto", () => {
  it("marks the photo saved and gives a haptic", async () => {
    const saver = jest.fn(async () => {});
    const { result } = await renderHook(() => useSavePhoto(saver));
    await act(async () => result.current.save(photo));
    expect(saver).toHaveBeenCalledWith(photo);
    expect(result.current.saves).toEqual({ p1: "saved" });
    expect(Haptics.notificationAsync).toHaveBeenCalled();
  });

  it("marks denied when the permission is refused and failed for other errors", async () => {
    const saver = jest.fn().mockRejectedValueOnce(new PermissionDeniedError(true)).mockRejectedValueOnce(new Error("boom"));
    const { result } = await renderHook(() => useSavePhoto(saver));
    await act(async () => result.current.save(photo));
    expect(result.current.saves.p1).toBe("denied");
    await act(async () => result.current.save(photo));
    expect(result.current.saves.p1).toBe("failed");
  });

  it("does nothing without a saver", async () => {
    const { result } = await renderHook(() => useSavePhoto(null));
    await act(async () => result.current.save(photo));
    expect(result.current.saves).toEqual({});
  });
});

describe("savedTarget", () => {
  it("is the photo unless its selfie is big", () => {
    expect(savedTarget(photo, true)).toBe(photo);
    expect(savedTarget(photo, false)).toBe(photo);
  });
});
