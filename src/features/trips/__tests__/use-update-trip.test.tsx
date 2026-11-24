import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { contestKey } from "@/features/contest/use-contest";
import { updateTrip } from "../actions";
import { useUpdateTrip } from "../use-update-trip";

jest.mock("../actions");
jest.mock("@/features/moments/moment-sync", () => ({ syncMoments: jest.fn() }));
const updateMock = jest.mocked(updateTrip);

const clients: QueryClient[] = [];
afterEach(() => {
  clients.forEach((c) => c.clear());
  clients.length = 0;
});

async function save(body: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const spy = jest.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = await renderHook(() => useUpdateTrip("t1"), { wrapper });
  updateMock.mockResolvedValue({} as never);
  await act(async () => result.current.mutate(body as never));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);
}

describe("useUpdateTrip", () => {
  it("also refreshes the contest when the contest settings changed", async () => {
    expect(await save({ contestEnabled: false })).toContainEqual(contestKey("t1"));
    expect(await save({ contestVotingHours: 48 })).toContainEqual(contestKey("t1"));
  });

  it("leaves the contest alone otherwise", async () => {
    expect(await save({ description: "Hola" })).not.toContainEqual(contestKey("t1"));
  });
});
