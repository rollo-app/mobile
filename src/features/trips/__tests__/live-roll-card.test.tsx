import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { tripSummary } from "@/test/account";
import { LiveRollCard, leftLabel } from "../live-roll-card";

let mockDetail: unknown = null;
let mockLeft: { photos: number } | null = null;
jest.mock("../use-trip-detail", () => ({ useTripDetail: () => ({ detail: mockDetail }) }));
jest.mock("@/features/capture/use-today-left", () => ({ useTodayLeft: () => mockLeft }));

const trip = tripSummary("t", "Sur", { startsAt: Date.now() - 1000, endsAt: Date.now() + 1000 });

describe("leftLabel", () => {
  it("words daily and total limits, singular and plural", () => {
    expect(leftLabel(6, "daily")).toBe("Te quedan 6 fotos hoy");
    expect(leftLabel(1, "daily")).toBe("Te queda 1 foto hoy");
    expect(leftLabel(0, "total")).toBe("Te quedan 0 fotos en el rollo");
    expect(leftLabel(1, "total")).toBe("Te queda 1 foto en el rollo");
  });
});

describe("LiveRollCard", () => {
  beforeEach(() => {
    mockDetail = { trip: { photoLimitMode: "total", timezone: "America/Argentina/Buenos_Aires" } };
    mockLeft = { photos: 4 };
  });

  it("shows LIVE, the day, the name and the photos left", async () => {
    await render(<LiveRollCard trip={trip} onOpen={() => {}} onCamera={() => {}} />);
    expect(screen.getByText("LIVE")).toBeTruthy();
    expect(screen.getByText("Día 1 de 1")).toBeTruthy();
    expect(screen.getByText("Sur")).toBeTruthy();
    expect(screen.getByText("Te quedan 4 fotos en el rollo")).toBeTruthy();
  });

  it("labels an event as Evento, also for VoiceOver", async () => {
    await render(<LiveRollCard trip={{ ...trip, type: "event" }} onOpen={() => {}} onCamera={() => {}} />);
    expect(screen.getByText("Evento")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sur, evento, en vivo" })).toBeTruthy();
  });

  it("has no Evento label on a regular roll", async () => {
    await render(<LiveRollCard trip={trip} onOpen={() => {}} onCamera={() => {}} />);
    expect(screen.queryByText("Evento")).toBeNull();
  });

  it("hides the photos line while unknown", async () => {
    mockLeft = null;
    await render(<LiveRollCard trip={trip} onOpen={() => {}} onCamera={() => {}} />);
    expect(screen.queryByText(/Te quedan|Te queda/)).toBeNull();
  });

  it("the camera button opens the camera, the card opens the roll", async () => {
    const onOpen = jest.fn();
    const onCamera = jest.fn();
    await render(<LiveRollCard trip={trip} onOpen={onOpen} onCamera={onCamera} />);
    await fireEvent.press(screen.getByRole("button", { name: "Sacar una foto en Sur" }));
    expect(onCamera).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Sur, en vivo" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("exposes the camera as an accessibility action of the card", async () => {
    const onCamera = jest.fn();
    await render(<LiveRollCard trip={trip} onOpen={() => {}} onCamera={onCamera} />);
    const card = screen.getByTestId("live-roll-card");
    expect(card.props.accessibilityActions).toEqual([{ name: "camera", label: "Sacar una foto" }]);
    await fireEvent(card, "accessibilityAction", { nativeEvent: { actionName: "camera" } });
    expect(onCamera).toHaveBeenCalledTimes(1);
  });

  it("has a dark background without a cover so the white text stays readable", async () => {
    await render(<LiveRollCard trip={{ ...trip, coverUrl: null, coverThumbhash: null }} onOpen={() => {}} onCamera={() => {}} />);
    const { backgroundColor } = StyleSheet.flatten(screen.getByTestId("live-roll-card").props.style);
    expect(backgroundColor).toBe("#2C2C2E");
  });
});
