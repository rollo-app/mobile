import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { composeStill } from "../compose-still";
import { writeShareFile } from "../share-story";
import { useStoryAssets } from "../use-story-assets";

jest.mock("../compose-still", () => ({ composeStill: jest.fn() }));
jest.mock("../share-story", () => ({ writeShareFile: jest.fn() }));

const write = jest.mocked(writeShareFile);

it("keeps file names short with 8 photo ids in the key", async () => {
  write.mockImplementation(async (_b, name) => `file:///cache/${name}`);
  jest.mocked(composeStill).mockResolvedValue(new Uint8Array([2]));
  const ids = Array.from({ length: 8 }, (_, i) => `1234567${i}-aaaa-4bbb-8ccc-0123456789ab`);
  const key = `11111111-2222-4333-8444-555555555555:collage:${ids.join(",")}`;
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const build = async () => ({ png: new Uint8Array([1]), width: 920, height: 1100 }) as never;
  const { result } = await renderHook(() => useStoryAssets(build, key, "collage", "dark"), { wrapper });
  await waitFor(() => expect(result.current.card).not.toBeNull());
  const names = write.mock.calls.map((c) => c[1]);
  expect(names).toHaveLength(2);
  for (const n of names) {
    expect(n.length).toBeLessThan(100);
    expect(n).toContain("collage");
    expect(n).toContain("dark");
  }
});
