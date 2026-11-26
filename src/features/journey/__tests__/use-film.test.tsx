import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Network from "expo-network";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { loadLayers, loadPhotos } from "../engine/assets";
import { useFilm } from "../use-film";

jest.mock("../engine/assets", () => ({
  loadLayers: jest.fn(),
  loadPhotos: jest.fn(),
  layoutTexts: jest.fn(() => []),
  incomplete: jest.fn((assets: { layers: unknown[] }) => assets.layers.some((l) => l === null)),
}));
jest.mock("../places", () => ({
  ...jest.requireActual("../places"),
  geocodeStops: jest.fn(async (stops: unknown[]) => stops.map(() => ({ city: "Ciudad", country: "Argentina", spot: null }))),
}));
jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })) }));

const layersMock = jest.mocked(loadLayers);
const photosMock = jest.mocked(loadPhotos);

const photo = (id: string, takenAt: number, lat = -34.6): RevealedPhoto =>
  ({
    id,
    type: "photo",
    takenAt,
    day: "2027-01-12",
    lat,
    lng: -58.4,
    shareable: true,
    archived: false,
    likeCount: 0,
    author: { id: "m1", userId: "u1", name: "Ana", username: null, avatarUrl: null },
    thumbPath: `/t/${id}/thumb`,
    displayPath: `/t/${id}/display`,
  }) as unknown as RevealedPhoto;

const detail = {
  trip: { name: "Viaje", startsAt: Date.UTC(2027, 0, 12, 12), endsAt: Date.UTC(2027, 0, 14, 12), timezone: "America/Argentina/Buenos_Aires" },
  totalUploaded: 9,
} as unknown as TripDetail;

const two = [photo("a", 1), photo("b", 2, -35.2)];
const onePlace = [photo("a", 1), photo("b", 2)];
const three = [photo("a", 1), photo("b", 2, -35.2), photo("c", 3, -36)];

const args = (over: Partial<Parameters<typeof useFilm>[0]> = {}) => ({ tripId: "t1", photos: two, token: "tok", detail, seed: 1, enabled: true, ...over });

beforeEach(() => {
  layersMock.mockReset().mockImplementation(async (specs) => specs.map(() => ({ image: {}, src: { x: 0, y: 0, w: 1, h: 1 } }) as never));
  photosMock.mockReset().mockResolvedValue({});
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: true } as never);
});

describe("useFilm", () => {
  it("goes from loading to a ready film that fits the share limit", async () => {
    const { result } = await renderHook(() => useFilm(args()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const film = result.current;
    if (film.status !== "ready") throw new Error("not ready");
    expect(film.scene.durationMs).toBeLessThanOrEqual(59_000);
    expect(film.stops).toHaveLength(2);
    expect(film.scene.input.closingStats).toContain("9 fotos");
  });

  it("does nothing while disabled", async () => {
    const { result } = await renderHook(() => useFilm(args({ enabled: false })));
    expect(result.current).toEqual({ status: "loading", done: 0, total: 0 });
    expect(layersMock).not.toHaveBeenCalled();
    expect(photosMock).not.toHaveBeenCalled();
  });

  it("reports no-route for one place and never asks for assets", async () => {
    const { result } = await renderHook(() => useFilm(args({ photos: onePlace })));
    await waitFor(() => expect(result.current.status).toBe("no-route"));
    expect(layersMock).not.toHaveBeenCalled();
    expect(photosMock).not.toHaveBeenCalled();
  });

  it("reports an error when the map images fail, and retry asks again", async () => {
    layersMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = await renderHook(() => useFilm(args()));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status !== "error") throw new Error("no error");
    expect(result.current.offline).toBe(false);
    const calls = layersMock.mock.calls.length;
    await act(async () => (result.current as { retry: () => void }).retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(layersMock.mock.calls.length).toBe(calls + 1);
  });

  it("treats a missing map image as an error, offline when there is no connection", async () => {
    layersMock.mockResolvedValueOnce([null] as never);
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: false } as never);
    const { result } = await renderHook(() => useFilm(args()));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ offline: true });
  });

  it("changes version with the seed and with the photo set", async () => {
    const versionOf = async (a: Parameters<typeof useFilm>[0]) => {
      const { result, unmount } = await renderHook(() => useFilm(a));
      await waitFor(() => expect(result.current.status).toBe("ready"));
      const v = result.current.status === "ready" ? result.current.version : "";
      await unmount();
      return v;
    };
    const base = await versionOf(args({ photos: three }));
    expect(await versionOf(args({ photos: three, seed: 2 }))).not.toBe(base);
    expect(await versionOf(args({ photos: two }))).not.toBe(base);
    expect(await versionOf(args({ photos: three }))).toBe(base);
  });

  it("does not restart when the caller rebuilds the same photos every render", async () => {
    const { result } = await renderHook(() => useFilm(args({ photos: [...two] })));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(layersMock).toHaveBeenCalledTimes(1);
  });

  it("never returns the old film for one render after the seed changes", async () => {
    const seen: string[] = [];
    const { result, rerender } = await renderHook((a: Parameters<typeof useFilm>[0]) => {
      const film = useFilm(a);
      seen.push(`${a.seed}:${film.status}`);
      return film;
    }, { initialProps: args() });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    seen.length = 0;
    await rerender(args({ seed: 5 }));
    expect(seen[0]).toBe("5:loading");
  });

  it("waits for the token, requesting nothing, then loads", async () => {
    const { result, rerender } = await renderHook((a: Parameters<typeof useFilm>[0]) => useFilm(a), { initialProps: args({ token: null }) });
    expect(result.current.status).toBe("loading");
    expect(layersMock).not.toHaveBeenCalled();
    await rerender(args({ token: "tok" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("never loads a non-shareable photo or a video", async () => {
    const mixed = [...two, { ...photo("hidden", 3, -36), shareable: false }, { ...photo("clip", 4, -36), type: "video" }] as RevealedPhoto[];
    const { result } = await renderHook(() => useFilm(args({ photos: mixed })));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ids = photosMock.mock.calls.flatMap((c) => c[0].map((i) => i.id));
    expect(ids).toEqual(expect.arrayContaining(["a", "b"]));
    expect(ids).not.toContain("hidden");
    expect(ids).not.toContain("clip");
  });

  it("ignores a run that was superseded while loading", async () => {
    let release: (v: never) => void = () => undefined;
    layersMock.mockImplementationOnce(() => new Promise((r) => (release = r as never)));
    const { result, rerender } = await renderHook((a: Parameters<typeof useFilm>[0]) => useFilm(a), { initialProps: args() });
    await waitFor(() => expect(layersMock).toHaveBeenCalledTimes(1));
    await rerender(args({ seed: 7 }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const seven = result.current.status === "ready" ? result.current.version : "";
    await act(async () => release([{ image: {}, src: {} }] as never));
    expect(result.current.status === "ready" && result.current.version).toBe(seven);
  });
});
