import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { RevealedPhoto } from "@/features/media/revealed";
import { downloadAll, PermissionDeniedError, requestAlbumAccess } from "../save";
import { useBulkSave } from "../use-bulk-save";

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success" },
}));
jest.mock("../save", () => ({
  ...jest.requireActual("../save"),
  downloadAll: jest.fn(),
  requestAlbumAccess: jest.fn(),
}));

const photos = ["a", "b"].map((id) => ({ id, type: "photo", selfie: null }) as unknown as RevealedPhoto);
const saver = jest.fn();
const setup = async (onSaved = jest.fn()) => ({
  onSaved,
  ...(await renderHook(() => useBulkSave({ saver, tripName: "Sur", photos, onSaved }))),
});

beforeEach(() => jest.resetAllMocks());

describe("useBulkSave", () => {
  it("runs a pass, shows the result and calls onSaved", async () => {
    jest.mocked(downloadAll).mockResolvedValue({ saved: 2, failed: [], cancelled: false } as never);
    const { result, onSaved } = await setup();
    await act(async () => result.current.run(photos));
    expect(result.current.bar).toMatchObject({ kind: "result", saved: 2, album: false, recents: false });
    expect(onSaved).toHaveBeenCalled();
  });

  it("does nothing without photos", async () => {
    const { result } = await setup();
    await act(async () => result.current.run([]));
    expect(downloadAll).not.toHaveBeenCalled();
    expect(result.current.bar).toBeNull();
  });

  it("shows the denied state when photo access is refused", async () => {
    jest.mocked(downloadAll).mockRejectedValue(new PermissionDeniedError(true));
    const { result } = await setup();
    await act(async () => result.current.run(photos));
    expect(result.current.bar).toEqual({ kind: "denied" });
  });

  it("clears the bar on any other error", async () => {
    jest.mocked(downloadAll).mockRejectedValue(new Error("boom"));
    const { result } = await setup();
    await act(async () => result.current.run(photos));
    expect(result.current.bar).toBeNull();
  });

  it("dismiss clears the result", async () => {
    jest.mocked(downloadAll).mockResolvedValue({ saved: 1, failed: [], cancelled: false } as never);
    const { result } = await setup();
    await act(async () => result.current.run(photos));
    await act(async () => result.current.dismiss());
    expect(result.current.bar).toBeNull();
  });

  it("confirmSaveAll asks first and then saves with the album", async () => {
    jest.mocked(requestAlbumAccess).mockResolvedValue(true);
    jest.mocked(downloadAll).mockResolvedValue({ saved: 2, failed: [], cancelled: false } as never);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = await setup();
    await act(async () => result.current.confirmSaveAll());
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("en Fotos"), expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons[1]!.onPress!());
    expect(result.current.bar).toMatchObject({ kind: "result", album: true, recents: false });
  });
});
