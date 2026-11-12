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
const setup = async (onSaved = jest.fn(), loadAll?: () => Promise<RevealedPhoto[] | null>) => ({
  onSaved,
  ...(await renderHook(() => useBulkSave({ saver, tripName: "Sur", photos, loadAll, onSaved }))),
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

  it("confirmSaveAll loads the pages the gallery had not loaded yet and saves every photo", async () => {
    const everything = ["a", "b", "c", "d"].map((id) => ({ id, type: "photo", selfie: null }) as unknown as RevealedPhoto);
    const loadAll = jest.fn(async () => everything);
    jest.mocked(requestAlbumAccess).mockResolvedValue(true);
    jest.mocked(downloadAll).mockResolvedValue({ saved: 4, failed: [], cancelled: false } as never);
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = await setup(jest.fn(), loadAll);
    await act(async () => result.current.confirmSaveAll());
    expect(loadAll).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("4 fotos"), expect.any(String), expect.any(Array));
    await act(async () => alert.mock.calls[0]![2]![1]!.onPress!());
    expect(jest.mocked(downloadAll).mock.calls[0]![0].map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("does not save a partial gallery when the rest could not be loaded", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { result } = await setup(jest.fn(), async () => null);
    await act(async () => result.current.confirmSaveAll());
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("No se pudieron cargar"), expect.any(String));
    expect(downloadAll).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
});
