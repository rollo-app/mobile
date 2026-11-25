import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ApiError } from "@/api/client";
import "@/test/reanimated";
import { updateTrip } from "../actions";
import { CoverFocusScreen } from "../cover-focus-screen";
import { useTripDetail } from "../use-trip-detail";

jest.mock("expo-router", () => ({ ...jest.requireActual("expo-router"), router: { back: jest.fn() } }));
// Reanimated and worklets are native: an empty object that `@/test/reanimated` fills with what the screen uses.
jest.mock("react-native-reanimated", () => ({}));
jest.mock("react-native-worklets", () => ({ scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../actions", () => ({ ...jest.requireActual("../actions"), updateTrip: jest.fn() }));
jest.mock("../use-trip-detail", () => ({ ...jest.requireActual("../use-trip-detail"), useTripDetail: jest.fn() }));

const updateMock = jest.mocked(updateTrip);

function mockDetail(coverFocusY: number | null) {
  jest.mocked(useTripDetail).mockReturnValue({ detail: { trip: { id: "t1", coverUrl: "/c.jpg", coverFocusY } } } as never);
}

async function renderScreen(props: { uri?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = jest.spyOn(client, "invalidateQueries");
  await render(
    <QueryClientProvider client={client}>
      <GestureHandlerRootView>
        <CoverFocusScreen tripId="t1" {...props} />
      </GestureHandlerRootView>
    </QueryClientProvider>,
  );
  return spy;
}

const band = () => screen.getByLabelText("Parte visible en la lista");
const move = (actionName: "increment" | "decrement") => fireEvent(band(), "accessibilityAction", { nativeEvent: { actionName } });

beforeEach(() => {
  jest.clearAllMocks();
  mockDetail(null);
  updateMock.mockResolvedValue({} as never);
});

describe("CoverFocusScreen", () => {
  it("lays the helper text and the photo out inside a scroll view that insets below the header", async () => {
    await renderScreen();
    const content = screen.getByTestId("cover-focus-content");
    expect(content.props.contentInsetAdjustmentBehavior).toBe("automatic");
    expect(within(content).getByText(/Arrastrá el recuadro/)).toBeTruthy();
    expect(within(content).getByTestId("cover-focus-band")).toBeTruthy();
  });

  it("exposes the band to VoiceOver as adjustable", async () => {
    await renderScreen();
    expect(band().props.accessibilityRole).toBe("adjustable");
  });

  it("saves the middle when nothing moved, and closes", async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("t1", { coverFocusY: 0.5 }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it("starts at the current focus", async () => {
    mockDetail(0.2);
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("t1", { coverFocusY: 0.2 }));
  });

  it("moves the band a tenth per VoiceOver increment/decrement and saves it", async () => {
    mockDetail(0.5);
    await renderScreen();
    await move("increment");
    await move("increment");
    await move("decrement");
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("t1", { coverFocusY: 0.6 }));
  });

  it("clamps the band to the photo", async () => {
    mockDetail(0.95);
    await renderScreen();
    await move("increment");
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("t1", { coverFocusY: 1 }));
  });

  it("refreshes the list and the detail after saving", async () => {
    const spy = await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const keys = spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);
    expect(keys).toContainEqual(["trip", "t1"]);
    expect(keys).toContainEqual(["myTrips"]);
  });

  it("shows the server's error inline and stays open", async () => {
    updateMock.mockRejectedValue(new ApiError(409, "Este rollo ya se reveló."));
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(await screen.findByText("Este rollo ya se reveló.")).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("cancels without saving", async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
    expect(router.back).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
