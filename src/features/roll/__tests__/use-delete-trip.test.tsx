import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";
import type { ReactNode } from "react";
import { deleteTrip } from "@/features/trips/actions";
import { useDeleteTrip } from "../use-delete-trip";

jest.mock("@/features/trips/actions");
jest.mock("@/features/moments/cancel", () => ({ cancelMomentNotifications: jest.fn() }));
const deleteMock = jest.mocked(deleteTrip);

describe("useDeleteTrip", () => {
  it("refreshes the cached users so your own roll count updates", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const spy = jest.spyOn(client, "invalidateQueries");
    jest.spyOn(router, "dismissTo").mockImplementation(() => {});
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    deleteMock.mockResolvedValue(undefined as never);
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = await renderHook(() => useDeleteTrip("t1", "Sur"), { wrapper });
    await act(async () => result.current.confirm());
    await act(async () => alert.mock.calls[0]![2]!.find((b) => b.text === "Borrar")!.onPress!());
    await waitFor(() => expect(spy.mock.calls.map(([f]) => (f as { queryKey: unknown }).queryKey)).toContainEqual(["user"]));
    client.clear();
  });
});
