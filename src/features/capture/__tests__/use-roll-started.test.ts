import { renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { hasSeenRollStarted, markRollStartedSeen } from "@/storage/roll-started";
import type { RollPhase } from "@/features/trips/phase";

// jest.setup mocks the hook out for screen tests; here we test the real one.
jest.unmock("@/features/capture/use-roll-started");
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const { useRollStarted } = jest.requireActual("@/features/capture/use-roll-started") as typeof import("@/features/capture/use-roll-started");
const push = jest.mocked(router.push);

/** Lets pending promises (the SecureStore reads) settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => push.mockReset());

type Props = { tripId: string | undefined; phase: RollPhase | null; ready: boolean };
const render = async (initialProps: Props) =>
  await renderHook((p: Props) => useRollStarted(p.tripId, p.phase, p.ready), { initialProps });

describe("useRollStarted", () => {
  it("does nothing until the saved active trip was read", async () => {
    await render({ tripId: "trip-1", phase: "active", ready: false });
    await flush();
    expect(push).not.toHaveBeenCalled();
    expect(await hasSeenRollStarted("trip-1")).toBe(false);
  });

  it("does nothing when the roll is not shooting", async () => {
    for (const phase of ["upcoming", "ended", "revealed", null] as (RollPhase | null)[]) {
      await render({ tripId: "trip-1", phase, ready: true });
    }
    await flush();
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing without a trip", async () => {
    await render({ tripId: undefined, phase: "active", ready: true });
    await flush();
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing when this roll already showed it", async () => {
    await markRollStartedSeen("trip-1");
    await render({ tripId: "trip-1", phase: "active", ready: true });
    await flush();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows the moment once and remembers it", async () => {
    const hook = await render({ tripId: "trip-1", phase: "active", ready: true });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/roll-started"));
    expect(await hasSeenRollStarted("trip-1")).toBe(true);

    await hook.rerender({ tripId: "trip-1", phase: "active", ready: true });
    await hook.unmount();
    await render({ tripId: "trip-1", phase: "active", ready: true });
    await flush();
    expect(push).toHaveBeenCalledTimes(1);
  });
});
