import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as Network from "expo-network";
import type { RevealedPhoto } from "@/features/media/revealed";
import type { TripDetail } from "@/features/trips/actions";
import { loadPhotos } from "../engine/assets";
import { localClocks, localMinutes } from "../sheet/local-time";
import { useSheetFilm } from "../use-sheet-film";

// jest.setup.ts replaces useSheetFilm for the screens that render it; this file tests the real one.
jest.unmock("../use-sheet-film");

jest.mock("../engine/assets", () => ({
  loadPhotos: jest.fn(),
  layoutTexts: jest.fn(() => []),
}));
jest.mock("expo-network", () => ({ getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })) }));

const photosMock = jest.mocked(loadPhotos);

const photo = (id: string, takenAt: number, over: Partial<RevealedPhoto> = {}): RevealedPhoto =>
  ({
    id,
    type: "photo",
    takenAt,
    day: "2027-01-12",
    lat: null,
    lng: null,
    shareable: true,
    archived: false,
    likeCount: 0,
    author: { id: "m1", userId: "u1", name: "ana", username: null, avatarUrl: null },
    thumbPath: `/t/${id}/thumb`,
    displayPath: `/t/${id}/display`,
    ...over,
  }) as unknown as RevealedPhoto;

const detail = {
  trip: { name: "Casamiento", startsAt: Date.UTC(2027, 0, 12, 12), endsAt: Date.UTC(2027, 0, 14, 12), timezone: "America/Argentina/Buenos_Aires" },
  totalUploaded: 9,
  members: [{}, {}, {}],
} as unknown as TripDetail;

const six = ["a", "b", "c", "d", "e", "f"].map((id, i) => photo(id, 1_800_000_000_000 + i * 60_000));
const five = six.slice(0, 5);

const args = (over: Partial<Parameters<typeof useSheetFilm>[0]> = {}) => ({
  tripId: "t1",
  cells: six,
  highlights: ["b", "d"],
  token: "tok",
  detail,
  seed: 1,
  enabled: true,
  ...over,
});

beforeEach(() => {
  photosMock.mockReset().mockResolvedValue({});
  jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: true } as never);
});

describe("useSheetFilm", () => {
  it("goes from loading to a ready sheet film that fits the share limit", async () => {
    const { result } = await renderHook(() => useSheetFilm(args()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready") throw new Error("not ready");
    const { film } = result.current;
    expect(film.kind).toBe("sheet");
    expect(film.durationMs).toBeLessThanOrEqual(59_000);
    if (film.kind !== "sheet") throw new Error("not a sheet");
    expect(film.restAt).toBe(film.scene.t.doneAt);
    expect(film.scene.input.name).toBe("Casamiento");
    expect(film.scene.input.closingLine).toBe("9 fotos · 3 personas");
    expect(film.scene.authors.a?.initial).toBe("A");
    expect(result.current.photos).toHaveLength(6);
  });

  it("uses singulars in the closing line", async () => {
    const one = { ...detail, totalUploaded: 1, members: [{}] } as unknown as TripDetail;
    const { result } = await renderHook(() => useSheetFilm(args({ detail: one })));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready" || result.current.film.kind !== "sheet") throw new Error("not ready");
    expect(result.current.film.scene.input.closingLine).toBe("1 foto · 1 persona");
  });

  it("is few under 6 cells and requests nothing", async () => {
    const { result } = await renderHook(() => useSheetFilm(args({ cells: five })));
    expect(result.current).toEqual({ status: "few" });
    expect(photosMock).not.toHaveBeenCalled();
  });

  it("does nothing while disabled", async () => {
    const { result } = await renderHook(() => useSheetFilm(args({ enabled: false })));
    expect(result.current).toEqual({ status: "loading", done: 0, total: 0 });
    expect(photosMock).not.toHaveBeenCalled();
  });

  it("reports an error when the photos fail, and retry asks again", async () => {
    photosMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = await renderHook(() => useSheetFilm(args()));
    await waitFor(() => expect(result.current.status).toBe("error"));
    if (result.current.status !== "error") throw new Error("no error");
    expect(result.current.offline).toBe(false);
    await act(async () => (result.current as { retry: () => void }).retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(photosMock).toHaveBeenCalledTimes(2);
  });

  it("is an offline error when there is no connection", async () => {
    photosMock.mockRejectedValueOnce(new Error("boom"));
    jest.mocked(Network.getNetworkStateAsync).mockResolvedValue({ isConnected: false } as never);
    const { result } = await renderHook(() => useSheetFilm(args()));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current).toMatchObject({ offline: true });
  });

  it("changes version with a highlight", async () => {
    const versionOf = async (a: Parameters<typeof useSheetFilm>[0]) => {
      const { result, unmount } = await renderHook(() => useSheetFilm(a));
      await waitFor(() => expect(result.current.status).toBe("ready"));
      const v = result.current.status === "ready" ? result.current.film.version : "";
      await unmount();
      return v;
    };
    const base = await versionOf(args());
    expect(await versionOf(args({ highlights: ["b", "e"] }))).not.toBe(base);
    expect(await versionOf(args())).toBe(base);
  });

  it("never returns the old film for one render after a highlight changes", async () => {
    const seen: string[] = [];
    const { result, rerender } = await renderHook(
      (a: Parameters<typeof useSheetFilm>[0]) => {
        const film = useSheetFilm(a);
        seen.push(`${a.highlights.join("")}:${film.status}`);
        return film;
      },
      { initialProps: args() },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    seen.length = 0;
    await rerender(args({ highlights: ["b", "e"] }));
    expect(seen[0]).toBe("be:loading");
  });

  it("requests thumbs and avatars of the shown cells only", async () => {
    const withAvatar = six.map((p) => ({ ...p, author: { ...p.author, avatarUrl: "https://x.test/a.png" } })) as RevealedPhoto[];
    const { result } = await renderHook(() => useSheetFilm(args({ cells: withAvatar })));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ids = photosMock.mock.calls.flatMap((c) => c[0].map((i) => i.id));
    expect(ids).toEqual(expect.arrayContaining(["a", "f"]));
    expect(ids.filter((id) => id.startsWith("avatar:"))).toHaveLength(1);
  });

  it("reads each photo's time with the zone's offset at that instant (daylight saving inside the roll)", async () => {
    // New York springs forward on 2027-03-14: 23:40 on the 13th is UTC-5, 23:40 on the 14th is UTC-4.
    const before = Date.UTC(2027, 2, 14, 4, 40);
    const after = Date.UTC(2027, 2, 15, 3, 40);
    const cells = [
      photo("a", before - 3 * 3_600_000),
      photo("b", before - 2 * 3_600_000),
      photo("c", before - 1 * 3_600_000),
      photo("d", before),
      photo("e", before + 12 * 3_600_000),
      photo("f", after),
    ];
    const ny = { ...detail, trip: { ...detail.trip, timezone: "America/New_York" } } as unknown as TripDetail;
    const { result } = await renderHook(() => useSheetFilm(args({ cells, highlights: ["d", "f"], detail: ny })));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status !== "ready" || result.current.film.kind !== "sheet") throw new Error("not ready");
    const days = result.current.film.scene.texts.filter((t) => t.role === "day").map((t) => t.text);
    expect(days).toEqual(["Día 1 · 23:40", "Día 2 · 23:40"]);
  });
});

describe("local clocks", () => {
  it("reads midnight as 0 and counts days from the earliest local day", () => {
    const zone = "America/Argentina/Buenos_Aires";
    const late = Date.UTC(2027, 0, 12, 2, 59); // 23:59 on the 11th, local
    const next = Date.UTC(2027, 0, 12, 3, 0); // 00:00 on the 12th, local
    expect(localMinutes(next, zone)).toBe(0);
    expect(localClocks([next, late], zone)).toEqual([
      { localMinutes: 0, day: 2 },
      { localMinutes: 1439, day: 1 },
    ]);
    expect(localClocks([], zone)).toEqual([]);
  });
});
