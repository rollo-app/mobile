import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { ApiError } from "@/api/client";
import { revealTrip } from "@/features/trips/actions";
import type { RollPhase } from "@/features/trips/phase";
import { RevealNowSection } from "../reveal-now";

jest.mock("@/features/trips/actions");
const revealMock = jest.mocked(revealTrip);

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
});

function show(phase: RollPhase, { isCreator = true, contest = false, type = "event" } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const detail = { trip: { id: "t1", name: "Boda", type, contest: contest ? { enabled: true, votingHours: 72 } : null }, me: { isCreator } };
  return render(
    <QueryClientProvider client={client}>
      <RevealNowSection detail={detail as never} phase={phase} />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());

describe("RevealNowSection", () => {
  it("is hidden for a non-creator, before the end and once revealed", async () => {
    for (const [phase, isCreator] of [["ended", false], ["active", true], ["upcoming", true], ["revealed", true]] as const) {
      const view = await show(phase, { isCreator });
      expect(screen.queryByText("Revelar ahora")).toBeNull();
      await view.unmount();
    }
  });

  it("is hidden for a regular trip", async () => {
    await show("ended", { type: "trip" });
    expect(screen.queryByText("Revelar ahora")).toBeNull();
  });

  it("confirms with an alert and reveals", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    revealMock.mockResolvedValue(undefined);
    await show("ended", { contest: true });
    await fireEvent.press(await screen.findByText("Revelar ahora"));
    expect(alert.mock.calls[0]![0]).toBe('¿Revelar "Boda" ahora?');
    expect(alert.mock.calls[0]![1]).toBe("Todos van a poder ver las fotos. No se puede deshacer. Se abre la votación del concurso.");
    const buttons = alert.mock.calls[0]![2]!;
    expect(buttons.map((b) => b.text)).toEqual(["Cancelar", "Revelar"]);
    buttons[1]!.onPress!();
    await waitFor(() => expect(revealMock).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(clients[0]!.isMutating()).toBe(0));
    alert.mockRestore();
  });

  it("shows the server's 409 inline", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    revealMock.mockRejectedValue(new ApiError(409, "Elegí al menos 2 fotos para el concurso o apagalo."));
    await show("ended", { contest: true });
    await fireEvent.press(await screen.findByText("Revelar ahora"));
    alert.mock.calls[0]![2]![1]!.onPress!();
    expect(await screen.findByText("Elegí al menos 2 fotos para el concurso o apagalo.")).toBeTruthy();
    alert.mockRestore();
  });
});
