import { OfflineManager } from "@maplibre/maplibre-react-native";
import { renderRouter, screen, fireEvent, waitFor } from "expo-router/testing-library";
import { Alert, type AlertButton } from "react-native";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");

const DAY = 24 * 60 * 60 * 1000;
const member = { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" as const };
const detail = (): actions.TripDetail => ({
  trip: {
    id: "t1", name: "Viaje al sur", joinCode: "HUB5FT", timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - DAY, endsAt: Date.now() + DAY, revealAt: Date.now() + DAY, revealed: false,
    dailyPhotoLimit: 10, dailyVideoLimit: 3,
  },
  me: member,
  members: [member],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 1,
});

const pack = {
  id: "p1",
  metadata: { name: "rollo:t1:detail:-49.33,-72.89", center: [-72.89, -49.33], radiusKm: 40, expiresAt: Date.now() + 1e9 },
  status: async () => ({ id: "p1", state: "complete", percentage: 100, completedResourceSize: 5 * 1024 * 1024 }),
};

describe("offline map screens", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(actions.fetchTrip).mockResolvedValue(detail());
    await signInAs({ trips: [tripSummary("t1", "Viaje al sur", { role: "admin" })] });
    jest.mocked(OfflineManager.getPacks).mockResolvedValue([pack] as never);
  });

  it("shows the state in Ajustes and opens the zones", async () => {
    await renderRouter(routes, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByLabelText("Mapa sin señal, Listo · 1 zona · 5 MB"));
    expect(screen).toHavePathname("/offline-maps");
    expect(await screen.findByText("Viaje al sur · Detallada")).toBeTruthy();
  });

  it("asks for confirmation before deleting the maps", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderRouter(routes, { initialUrl: "/offline-maps" });
    await fireEvent.press(await screen.findByLabelText("Borrar mapas sin señal"));

    expect(OfflineManager.deletePack).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2] as AlertButton[];
    await buttons.find((b) => b.style === "destructive")!.onPress!();
    await waitFor(() => expect(OfflineManager.clearAmbientCache).toHaveBeenCalled());
    expect(OfflineManager.deletePack).toHaveBeenCalledWith("p1");
  });
});
