import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import * as actions from "../actions";
import { useMyRolloFeaturing, useRolloPrivate } from "../use-featuring-levels";
import { usePrivacySettings } from "../use-privacy-settings";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(["featured-by"], { pages: [], pageParams: [] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}
const stale = (client: ReturnType<typeof createQueryClient>) => client.getQueryState(["featured-by"])?.isInvalidated;

describe("what takes your photos off other profiles refreshes 'Destacaron tus fotos'", () => {
  beforeEach(() => jest.resetAllMocks());

  it("the account switch", async () => {
    jest.mocked(actions).fetchPrivacySettings.mockResolvedValue({ allowFeaturing: true });
    jest.mocked(actions).updatePrivacySettings.mockResolvedValue({ allowFeaturing: false });
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => usePrivacySettings(), { wrapper });
    await act(async () => result.current.set(false));
    await waitFor(() => expect(stale(queryClient)).toBe(true));
  });

  it("the switch of one rollo", async () => {
    jest.mocked(actions).setMyFeaturing.mockResolvedValue(undefined as never);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useMyRolloFeaturing("t1", true), { wrapper });
    await act(async () => result.current.set(false));
    await waitFor(() => expect(stale(queryClient)).toBe(true));
  });

  it("making the rollo private", async () => {
    jest.mocked(actions).setTripPrivate.mockResolvedValue(undefined as never);
    const { queryClient, wrapper } = setup();
    const { result } = await renderHook(() => useRolloPrivate("t1", false), { wrapper });
    await act(async () => result.current.set(true));
    await waitFor(() => expect(stale(queryClient)).toBe(true));
  });
});
