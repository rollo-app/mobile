import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { useChapterPlace } from "../use-chapter-place";

jest.mock("expo-location", () => ({ reverseGeocodeAsync: jest.fn() }));
const geocode = Location.reverseGeocodeAsync as jest.Mock;

const at = (lat: number, lng: number) => ({ lat, lng });

const client = createQueryClient();
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => geocode.mockReset());
afterEach(() => client.clear());

describe("useChapterPlace", () => {
  it("returns the city", async () => {
    geocode.mockResolvedValue([{ city: "Bariloche", subregion: null, region: null }]);
    const { result } = await renderHook(() => useChapterPlace(at(-41.13, -71.31), true), { wrapper });
    await waitFor(() => expect(result.current).toBe("Bariloche"));
    expect(geocode).toHaveBeenCalledWith({ latitude: -41.13, longitude: -71.31 });
  });

  it("returns null when geocoding throws and does not retry", async () => {
    geocode.mockRejectedValue(new Error("no network"));
    const { result } = await renderHook(() => useChapterPlace(at(-41.13, -71.31), true), { wrapper });
    await waitFor(() => expect(geocode).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
    expect(geocode).toHaveBeenCalledTimes(1);
  });

  it("two chapters in the same km geocode once", async () => {
    geocode.mockResolvedValue([{ city: "Bariloche" }]);
    const one = await renderHook(() => useChapterPlace(at(-41.131, -71.311), true), { wrapper });
    await waitFor(() => expect(one.result.current).toBe("Bariloche"));
    const two = await renderHook(() => useChapterPlace(at(-41.132, -71.312), true), { wrapper });
    await waitFor(() => expect(two.result.current).toBe("Bariloche"));
    expect(geocode).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a center", async () => {
    const { result } = await renderHook(() => useChapterPlace(null, true), { wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
    expect(geocode).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", async () => {
    const { result } = await renderHook(() => useChapterPlace(at(-41.13, -71.31), false), { wrapper });
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBeNull();
    expect(geocode).not.toHaveBeenCalled();
  });
});
