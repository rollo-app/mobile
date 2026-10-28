import { File } from "expo-file-system";
import { signInAs, tripSummary } from "@/test/account";
import { queryClient } from "@/api/query-client";
import { memoryDb } from "@/test/sqlite-memory";
import { createQueue } from "../queue";
import { getQueue } from "../store";
import { syncQueue } from "../sync";

const TRIP = "11111111-1111-4111-8111-111111111111";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("syncQueue", () => {
  beforeEach(async () => {
    await signInAs({ trips: [tripSummary(TRIP, "Viaje al sur", { role: "admin" })] });
    const queue = await createQueue(memoryDb());
    jest.mocked(getQueue).mockResolvedValue(queue);
    await queue.enqueue({
      id: ID,
      tripId: TRIP,
      type: "photo",
      takenAt: 1000,
      day: "2027-01-12",
      lat: null, lng: null, accuracyM: null, caption: null, durationS: null, width: 4000, height: 3000,
      sizeBytes: 1,
      originalUri: "file:///docs/pending/a/original.jpg",
      thumbUri: "file:///docs/pending/a/thumb.jpg",
      thumbhash: null,
      ownerUserId: "u1",
    });
    globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : new Request(input as string, init);
      if (req.url.endsWith("/complete")) return json(200, { id: ID, status: "uploaded" });
      return json(201, {
        id: ID,
        status: "pending",
        upload: { original: "https://r2.test/original", thumb: "https://r2.test/thumb" },
        expiresIn: 900,
      });
    }) as typeof fetch;
  });

  it("uploads the files with PUT using expo-file-system, confirms and invalidates the trip", async () => {
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const upload = jest.spyOn(File.prototype, "upload");

    await syncQueue();

    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenCalledWith("https://r2.test/original", expect.objectContaining({ httpMethod: "PUT" }));
    expect((await (await getQueue()).pending("u1"))).toHaveLength(0);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["trip", TRIP] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["feed", TRIP] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["pending-items", TRIP] });
  });
});
