import * as Notifications from "expo-notifications";
import { setSessionToken } from "@/storage/session";
import { forgetPushToken, syncPushToken } from "../push-token";

const notifications = jest.mocked(Notifications);
const TOKEN = "ExponentPushToken[abc+/=]";

function mockFetch(status = 204) {
  const fetchMock = jest.fn(async (_req: Request) => new Response(null, { status }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const requests = (m: jest.Mock) => m.mock.calls.map(([r]) => r as Request);
const permission = (granted: boolean, canAskAgain: boolean, status: string) =>
  notifications.getPermissionsAsync.mockResolvedValue({ granted, canAskAgain, status } as never);

beforeEach(async () => {
  jest.clearAllMocks();
  await setSessionToken("tok");
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: "expo", data: TOKEN });
});
afterEach(() => permission(false, true, "undetermined"));

describe("syncPushToken", () => {
  it("with permission, registers this phone's Expo token with the EAS project id, URL-encoded once in the path", async () => {
    permission(true, true, "granted");
    const fetchMock = mockFetch();

    await syncPushToken();

    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "124fc671-d309-4a16-9606-e4e900286752" });
    const [request] = requests(fetchMock);
    expect(request!.method).toBe("PUT");
    expect(request!.url).toMatch(/\/me\/push-tokens\/ExponentPushToken%5Babc%2B%2F%3D%5D$/);
    expect(request!.headers.get("authorization")).toBe("Bearer tok");
  });

  it("without permission it asks nothing and sends nothing", async () => {
    const fetchMock = mockFetch();

    await syncPushToken();

    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails silently when the build can't get a token (dev build without push) or the server fails", async () => {
    permission(true, true, "granted");
    const fetchMock = mockFetch(500);
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error("no aps-environment"));

    await expect(syncPushToken()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(syncPushToken()).resolves.toBeUndefined();
  });
});

describe("forgetPushToken", () => {
  it("unregisters the token this phone registered", async () => {
    permission(true, true, "granted");
    mockFetch();
    await syncPushToken();
    const fetchMock = mockFetch();

    await forgetPushToken();

    const [request] = requests(fetchMock);
    expect(request!.method).toBe("DELETE");
    expect(request!.url).toMatch(/\/me\/push-tokens\/ExponentPushToken%5Babc%2B%2F%3D%5D$/);
  });

  it("with nothing registered and no permission, does nothing", async () => {
    permission(true, true, "granted");
    mockFetch();
    await syncPushToken();
    mockFetch();
    await forgetPushToken();
    permission(false, false, "denied");
    const fetchMock = mockFetch();

    await forgetPushToken();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    permission(true, true, "granted");
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;

    await expect(forgetPushToken()).resolves.toBeUndefined();
  });
});
