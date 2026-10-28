import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import * as actions from "../actions";
import { useCreateFriendLink } from "../use-create-friend-link";

jest.mock("../actions");

function setup() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { wrapper };
}

describe("useCreateFriendLink", () => {
  beforeEach(() => jest.resetAllMocks());

  it("resolves with the new link", async () => {
    jest.mocked(actions).createFriendLink.mockResolvedValue({ code: "ABCD1234" } as never);
    const { wrapper } = setup();
    const { result } = await renderHook(() => useCreateFriendLink(), { wrapper });
    let link;
    await act(async () => {
      link = await result.current.mutateAsync();
    });
    expect(link).toEqual({ code: "ABCD1234" });
  });

  it("exposes the error when it fails", async () => {
    jest.mocked(actions).createFriendLink.mockRejectedValue(new Error("nope"));
    const { wrapper } = setup();
    const { result } = await renderHook(() => useCreateFriendLink(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });
    await waitFor(() => expect(result.current.error).toEqual(new Error("nope")));
  });
});
