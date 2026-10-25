import { setSessionToken } from "@/storage/session";
import {
  blockFeature,
  featureMedia,
  fetchFeatured,
  fetchPrivacySettings,
  setMyFeaturing,
  setTripPrivate,
  unblockFeature,
  unfeatureMedia,
  updatePrivacySettings,
  type FeaturedPhoto,
} from "../actions";

type Route = [RegExp, number, unknown?];
function mockApi(routes: Route[]) {
  const fetchMock = jest.fn(async (req: Request) => {
    const [, status, body] = routes.find(([re]) => re.test(`${req.method} ${new URL(req.url).pathname}`)) ?? [/./, 404, { error: "no route" }];
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
const request = (fetchMock: jest.Mock, i = 0) => fetchMock.mock.calls[i]![0] as Request;

const photo: FeaturedPhoto = {
  mediaId: "m1",
  takenAt: 1,
  width: 4000,
  height: 3000,
  thumbhash: null,
  author: null,
  zone: { lat: -41.075, lng: -71.475 },
  thumbPath: "/featured/u1/m1/thumb",
  originalPath: "/featured/u1/m1/original",
  likeCount: 0,
  likedByMe: false,
};

beforeEach(() => setSessionToken("tok"));

describe("featureMedia", () => {
  it("PUTs /me/featured/{mediaId} with the session", async () => {
    const fetchMock = mockApi([[/^PUT \/me\/featured\/m1$/, 204]]);

    await featureMedia("m1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request(fetchMock).headers.get("Authorization")).toBe("Bearer tok");
  });

  it("propagates the server's message (e.g. the 60 cap)", async () => {
    mockApi([[/^PUT \/me\/featured\/m1$/, 409, { error: "Podés destacar hasta 60 fotos" }]]);
    await expect(featureMedia("m1")).rejects.toThrow("Podés destacar hasta 60 fotos");
  });
});

describe("unfeatureMedia", () => {
  it("DELETEs /me/featured/{mediaId}", async () => {
    const fetchMock = mockApi([[/^DELETE \/me\/featured\/m1$/, 204]]);
    await unfeatureMedia("m1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("blockFeature", () => {
  it("PUTs /media/{mediaId}/feature-block", async () => {
    const fetchMock = mockApi([[/^PUT \/media\/m1\/feature-block$/, 204]]);
    await blockFeature("m1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a 403 when you didn't take it", async () => {
    mockApi([[/./, 403, { error: "Solo quien sacó la foto puede hacer esto" }]]);
    await expect(blockFeature("m1")).rejects.toThrow("Solo quien sacó la foto puede hacer esto");
  });
});

describe("unblockFeature", () => {
  it("DELETEs /media/{mediaId}/feature-block", async () => {
    const fetchMock = mockApi([[/^DELETE \/media\/m1\/feature-block$/, 204]]);
    await unblockFeature("m1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchFeatured", () => {
  it("GETs /users/{userId}/featured and returns the photos", async () => {
    const fetchMock = mockApi([[/^GET \/users\/u1\/featured$/, 200, { photos: [photo] }]]);

    expect(await fetchFeatured("u1")).toEqual([photo]);
    expect(request(fetchMock).headers.get("Authorization")).toBe("Bearer tok");
  });

  it("propagates the private-profile error", async () => {
    mockApi([[/^GET \/users\/u1\/featured$/, 403, { error: "Este perfil es privado" }]]);
    await expect(fetchFeatured("u1")).rejects.toThrow("Este perfil es privado");
  });
});

describe("featuring levels", () => {
  const settings = { notifications: {}, privacy: { allowFeaturing: true } };

  it("fetchPrivacySettings reads privacy from GET /me/settings", async () => {
    mockApi([[/^GET \/me\/settings$/, 200, settings]]);

    expect(await fetchPrivacySettings()).toEqual({ allowFeaturing: true });
  });

  it("updatePrivacySettings PATCHes only privacy and returns it", async () => {
    const fetchMock = mockApi([[/^PATCH \/me\/settings$/, 200, { ...settings, privacy: { allowFeaturing: false } }]]);

    expect(await updatePrivacySettings({ allowFeaturing: false })).toEqual({ allowFeaturing: false });
    expect(await request(fetchMock).json()).toEqual({ privacy: { allowFeaturing: false } });
  });

  it("setMyFeaturing PATCHes /trips/{id}/members/me", async () => {
    const fetchMock = mockApi([[/^PATCH \/trips\/t1\/members\/me$/, 200, { allowFeaturing: false }]]);

    await setMyFeaturing("t1", false);
    expect(await request(fetchMock).json()).toEqual({ allowFeaturing: false });
  });

  it("setTripPrivate PATCHes featuringDisabled on /trips/{id}", async () => {
    const fetchMock = mockApi([[/^PATCH \/trips\/t1$/, 200, { trip: {} }]]);

    await setTripPrivate("t1", true);
    expect(await request(fetchMock).json()).toEqual({ featuringDisabled: true });
  });

  it("propagates the server's message", async () => {
    mockApi([[/^PATCH \/me\/settings$/, 400, { error: "No se pudo" }]]);

    await expect(updatePrivacySettings({ allowFeaturing: false })).rejects.toThrow("No se pudo");
  });
});
