import { renderHook } from "@testing-library/react-native";
import { useBlocked } from "@/features/moderation/use-blocked";
import { useStoryCredits } from "../use-story-credits";

jest.mock("@/features/moderation/use-blocked", () => ({ useBlocked: jest.fn() }));
const blockedState = jest.mocked(useBlocked);

const friend = (id: string) => ({ id, name: id, username: null, avatarUrl: null }) as never;
const state = (blocked: unknown[] | null, error: string | null = null) =>
  ({ blocked, error, refetch: jest.fn(), isRefetching: false }) as unknown as ReturnType<typeof useBlocked>;

describe("useStoryCredits", () => {
  it("is ready with no credits for an event, without waiting for the blocked list", async () => {
    blockedState.mockReturnValue(state(null));
    const { result } = await renderHook(() => useStoryCredits({ type: "event" }));
    expect(result.current).toEqual({ ready: true, credits: undefined });
  });

  it("waits for the blocked list on a trip", async () => {
    blockedState.mockReturnValue(state(null));
    const { result } = await renderHook(() => useStoryCredits({ type: "trip" }));
    expect(result.current.ready).toBe(false);
    expect(result.current.credits).toBeUndefined();
  });

  it("is ready with the blocked user ids once the list loaded", async () => {
    blockedState.mockReturnValue(state([friend("u1"), friend("u2")]));
    const { result } = await renderHook(() => useStoryCredits({ type: "trip" }));
    expect(result.current.ready).toBe(true);
    expect(result.current.credits).toEqual({ blockedUserIds: new Set(["u1", "u2"]) });
  });

  it("is ready with an empty set when nobody is blocked", async () => {
    blockedState.mockReturnValue(state([]));
    const { result } = await renderHook(() => useStoryCredits({ type: "trip" }));
    expect(result.current).toEqual({ ready: true, credits: { blockedUserIds: new Set() } });
  });

  it("is ready with no credits when the list could not load", async () => {
    blockedState.mockReturnValue(state(null, "No se pudieron cargar los bloqueos"));
    const { result } = await renderHook(() => useStoryCredits({ type: "trip" }));
    expect(result.current).toEqual({ ready: true, credits: undefined });
  });

  it("keeps the same credits object while the ids don't change", async () => {
    blockedState.mockReturnValue(state([friend("u2"), friend("u1")]));
    const { result, rerender } = await renderHook(() => useStoryCredits({ type: "trip" }));
    const first = result.current.credits;
    blockedState.mockReturnValue(state([friend("u1"), friend("u2")]));
    await rerender({});
    expect(result.current.credits).toBe(first);
  });
});
