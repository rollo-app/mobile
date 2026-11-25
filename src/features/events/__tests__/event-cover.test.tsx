import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import type { TripDetail } from "@/features/trips/actions";
import { EventCover } from "../event-cover";

jest.mock("expo-router", () => ({ ...jest.requireActual("expo-router"), router: { push: jest.fn() } }));
jest.mock("../use-upload-cover", () => ({ useUploadCover: () => ({ pick: jest.fn(), uploading: false, error: null }) }));

const detail = (over: { coverUrl?: string | null; revealed?: boolean; role?: "admin" | "member" } = {}) =>
  ({ trip: { id: "t1", coverUrl: "/c.jpg", revealed: false, ...over }, me: { role: over.role ?? "admin" } }) as unknown as TripDetail;

async function renderCover(d: TripDetail) {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <EventCover detail={d} />
    </QueryClientProvider>,
  );
}

describe("EventCover: Ajustar banner", () => {
  it("shows for an admin of a rollo with a cover, before the reveal, and opens the band screen", async () => {
    await renderCover(detail());
    await fireEvent.press(screen.getByRole("button", { name: "Ajustar banner" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/cover-focus", params: { tripId: "t1" } });
  });

  it("is hidden without a cover", async () => {
    await renderCover(detail({ coverUrl: null }));
    expect(screen.queryByText("Ajustar banner")).toBeNull();
    expect(screen.getByText("Elegir portada")).toBeTruthy();
  });

  it("is hidden for members and after the reveal", async () => {
    await renderCover(detail({ role: "member" }));
    expect(screen.queryByText("Ajustar banner")).toBeNull();
  });

  it("is hidden after the reveal", async () => {
    await renderCover(detail({ revealed: true }));
    expect(screen.queryByText("Ajustar banner")).toBeNull();
  });
});
