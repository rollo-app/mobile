import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { createQueryClient } from "@/api/query-client";
import { useMe } from "@/features/auth/use-me";
import { usePrivacySettings } from "@/features/featured/use-privacy-settings";
import { useFriends } from "@/features/friends/use-friends";
import { useBlocked } from "@/features/moderation/use-blocked";
import { useNotificationSettings } from "@/features/notifications/use-notification-settings";
import { setSessionToken } from "@/storage/session";

const MINUTE = 60_000;
const NOW = Date.UTC(2027, 0, 12, 15);
let now: number;
let hits: string[];

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(async () => {
  now = NOW;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  await setSessionToken("tok");
  hits = [];
  globalThis.fetch = jest.fn(async (req: Request) => {
    const path = new URL(req.url).pathname;
    hits.push(path);
    if (path === "/me") return json({ id: "u1", email: "a@b.c", name: "J", username: "j", avatarUrl: null, bio: null, badge: null, profileVisibility: "friends" });
    if (path === "/me/settings") return json({ notifications: {}, privacy: { allowFeaturing: true } });
    if (path === "/blocks") return json({ blocked: [] });
    return json({ friends: [] });
  }) as unknown as typeof fetch;
});
afterEach(() => jest.restoreAllMocks());

/** Mounts the hook, waits for its request, unmounts, lets `minutes` pass and mounts it again: how many requests in all? */
async function requestsAfterRemount(useHook: () => unknown, path: string, minutes: number) {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const first = await renderHook(useHook, { wrapper });
  await waitFor(() => expect(hits.filter((h) => h === path).length).toBe(1));
  await first.unmount();
  now += minutes * MINUTE;
  const second = await renderHook(useHook, { wrapper });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await second.unmount();
  return hits.filter((h) => h === path).length;
}

describe("staleTime of the data you change yourself", () => {
  it.each([
    ["me", () => useMe(), "/me"],
    ["privacy settings", () => usePrivacySettings(), "/me/settings"],
    ["notification settings", () => useNotificationSettings(), "/me/settings"],
    ["blocked", () => useBlocked(), "/blocks"],
  ] as const)("%s is not refetched on a remount 2 minutes later", async (_name, hook, path) => {
    expect(await requestsAfterRemount(hook, path, 2)).toBe(1);
  });

  it.each([
    ["me", () => useMe(), "/me"],
    ["blocked", () => useBlocked(), "/blocks"],
  ] as const)("%s is refetched once it is older than 5 minutes", async (_name, hook, path) => {
    expect(await requestsAfterRemount(hook, path, 6)).toBe(2);
  });

  it("the friends list, which other people change, keeps the 30 s default", async () => {
    expect(await requestsAfterRemount(() => useFriends(), "/friends", 2)).toBe(2);
  });
});
