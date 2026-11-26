import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Network from "expo-network";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { loadPhotos, loadPosterMap } from "../../engine/assets";
import { geocodeStops } from "../../places";
import { renderPoster } from "../render-poster";
import { usePoster } from "../use-poster";

// jest.setup.ts replaces usePoster for the screens that render it; this file tests the real one.
jest.unmock("../use-poster");

jest.mock("../../engine/assets", () => ({
  loadPosterMap: jest.fn(),
  loadPhotos: jest.fn(),
}));
jest.mock("../../places", () => ({
  ...jest.requireActual("../../places"),
  geocodeStops: jest.fn(),
}));
jest.mock("@/features/share/share-story", () => ({ writeShareFile: jest.fn(async () => "file:///cache/afiche.jpg") }));
jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })) }));

const mapMock = jest.mocked(loadPosterMap);
const photosMock = jest.mocked(loadPhotos);
const geocodeMock = jest.mocked(geocodeStops);
const renderMock = jest.mocked(renderPoster);

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
    author: { id: "m1", userId: "u1", name: "Ana", username: null, avatarUrl: "https://example.test/ana.png" },
    thumbPath: `/t/${id}/thumb`,
    displayPath: `/t/${id}/display`,
  }) as unknown as RevealedPhoto;

const detail = {
  trip: { name: "Viaje", startsAt: Date.UTC(2027, 0, 12, 12), endsAt: Date.UTC(2027, 0, 14, 12), timezone: "America/Argentina/Buenos_Aires" },
  totalUploaded: 9,
} as unknown as TripDetail;

const two = [photo("a", 1), photo("b", 2, -35.2)];
const onePlace = [photo("a", 1), photo("b", 2)];

const args = (over: Partial<Parameters<typeof usePoster>[0]> = {}) => ({ tripId: "t1", photos: two, token: "tok", detail, enabled: true, ...over });

beforeEach(() => {
  mapMock.mockReset().mockResolvedValue({ image: {}, src: { x: 0, y: 0, w: 1, h: 1 } } as never);
  photosMock.mockReset().mockResolvedValue({});
  geocodeMock.mockReset().mockImplementation(async (stops) => stops.map(() => ({ city: "Ciudad", country: "Argentina", spot: null })));
  renderMock.mockClear();
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: true } as never);
});

describe("usePoster", () => {
  it("builds the poster and hands its file", async () => {
    const { result } = await renderHook(() => usePoster(args()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current).toMatchObject({ status: "ready", uri: "file:///cache/afiche.jpg" });
    const [spec, density] = mapMock.mock.calls[0]!;
    expect(spec.labels).toBe(false);
    expect(spec.zoom).toBeLessThanOrEqual(9.6);
    expect(density).toBe(2.5);
    const input = renderMock.mock.calls[0]![0];
    expect(input.stats[2]).toEqual({ value: "2", label: "lugares" });
    expect(input.name).toBe("Viaje");
  });

  it("only geocodes cell centres", async () => {
    const { result } = await renderHook(() => usePoster(args()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const asked = geocodeMock.mock.calls[0]![0];
    expect(asked.length).toBeGreaterThan(0);
    for (const { lat, lng } of asked) {
      for (const v of [lat, lng]) {
        const cells = (v - 0.025) / 0.05;
        expect(Math.abs(cells - Math.round(cells))).toBeLessThan(1e-6);
      }
      expect([-34.6, -35.2]).not.toContain(lat);
    }
  });

  it("has no route with a single place", async () => {
    const { result } = await renderHook(() => usePoster(args({ photos: onePlace })));
    await waitFor(() => expect(result.current.status).toBe("no-route"));
    expect(mapMock).not.toHaveBeenCalled();
  });

  it("still builds without place names", async () => {
    geocodeMock.mockImplementation(async (stops) => stops.map(() => ({ city: null, country: null, spot: null })));
    const { result } = await renderHook(() => usePoster(args()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(renderMock.mock.calls[0]![0].layout.cities).toEqual([]);
  });

  it("reports a failed map, offline, and retries", async () => {
    mapMock.mockRejectedValueOnce(new Error("boom"));
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: false } as never);
    const { result } = await renderHook(() => usePoster(args()));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ status: "error", offline: true });
    await act(async () => (result.current as { retry: () => void }).retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("requests nothing while disabled or without a token", async () => {
    const disabled = await renderHook(() => usePoster(args({ enabled: false })));
    const noToken = await renderHook(() => usePoster(args({ token: null })));
    expect(disabled.result.current.status).toBe("loading");
    expect(noToken.result.current.status).toBe("loading");
    expect(geocodeMock).not.toHaveBeenCalled();
    expect(mapMock).not.toHaveBeenCalled();
    expect(photosMock).not.toHaveBeenCalled();
  });

  it("pins never use an author's avatar", async () => {
    const { result } = await renderHook(() => usePoster(args()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ids = photosMock.mock.calls.flatMap((c) => c[0].map((i) => i.id));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.startsWith("avatar:")).toBe(false);
  });
});
