import { File } from "expo-file-system";
import { setSessionToken } from "@/storage/session";
import { checkUsername, fetchUser, fetchUserFriends, updateProfile, uploadAvatar } from "../actions";

jest.mock("expo-image-manipulator", () => {
  const ctx = { resize: jest.fn(), renderAsync: jest.fn(async () => ({ saveAsync: jest.fn(async () => ({ uri: "file:///cache/avatar.jpg", width: 512, height: 512 })) })) };
  return { ImageManipulator: { manipulate: jest.fn(() => ctx), __ctx: ctx }, SaveFormat: { JPEG: "jpeg" } };
});

const user = { id: "u1", email: "a@b.c", name: "Juani", username: "juani", avatarUrl: "/avatars/u1/a.jpg" };

type Route = [RegExp, number, unknown?];
function mockApi(routes: Route[]) {
  const fetchMock = jest.fn(async (req: Request) => {
    const [, status, body] = routes.find(([re]) => re.test(`${req.method} ${new URL(req.url).pathname}`)) ?? [/./, 404, { error: "no route" }];
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => setSessionToken("tok"));
afterEach(() => jest.restoreAllMocks());

describe("updateProfile", () => {
  it("sends the trimmed name and the normalized username and returns the user", async () => {
    const fetchMock = mockApi([[/^PATCH \/me$/, 200, user]]);

    expect(await updateProfile({ name: "  Juani ", username: " @Juani " })).toEqual(user);
    expect(await (fetchMock.mock.calls[0]![0] as Request).json()).toEqual({ name: "Juani", username: "juani" });
  });

  it("sends the description as typed when given, and leaves it out otherwise", async () => {
    const fetchMock = mockApi([[/^PATCH \/me$/, 200, user]]);

    await updateProfile({ name: "Juani", username: "juani", bio: "Viajando por el sur" });
    expect(await (fetchMock.mock.calls[0]![0] as Request).json()).toEqual({ name: "Juani", username: "juani", bio: "Viajando por el sur" });
  });

  it("sends only the profile visibility when that's all that changes", async () => {
    const fetchMock = mockApi([[/^PATCH \/me$/, 200, user]]);

    await updateProfile({ profileVisibility: "public" });
    expect(await (fetchMock.mock.calls[0]![0] as Request).json()).toEqual({ profileVisibility: "public" });
  });

  it("propagates the server's message", async () => {
    mockApi([[/^PATCH \/me$/, 409, { error: "Ese nombre de usuario ya está en uso." }]]);
    await expect(updateProfile({ name: "x", username: "taken" })).rejects.toThrow("Ese nombre de usuario ya está en uso.");
  });
});

describe("fetchUser", () => {
  it("GETs /users/{userId} and returns the profile", async () => {
    const profile = { user: { id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null }, isFriend: false, profileVisibility: "friends", canSee: false, friendCount: 3, mutualCount: 1 };
    const fetchMock = mockApi([[/^GET \/users\/u2$/, 200, profile]]);

    expect(await fetchUser("u2")).toEqual(profile);
    expect((fetchMock.mock.calls[0]![0] as Request).headers.get("Authorization")).toBe("Bearer tok");
  });

  it("propagates a 404", async () => {
    mockApi([[/./, 404, { error: "No existe" }]]);
    await expect(fetchUser("u2")).rejects.toThrow("No existe");
  });
});

describe("fetchUserFriends", () => {
  it("GETs /users/{userId}/friends and returns the scope and the list", async () => {
    const body = { scope: "mutual", friends: [{ id: "u3", name: "Tomi", username: "tomi", avatarUrl: null }] };
    const fetchMock = mockApi([[/^GET \/users\/u2\/friends$/, 200, body]]);

    expect(await fetchUserFriends("u2")).toEqual(body);
    expect((fetchMock.mock.calls[0]![0] as Request).headers.get("Authorization")).toBe("Bearer tok");
  });

  it("propagates a 404", async () => {
    mockApi([[/./, 404, { error: "No existe" }]]);
    await expect(fetchUserFriends("u2")).rejects.toThrow("No existe");
  });
});

describe("checkUsername", () => {
  it("asks the server and returns the availability", async () => {
    const fetchMock = mockApi([[/^GET \/usernames\/juani$/, 200, { available: true, username: "juani" }]]);

    expect(await checkUsername("@Juani")).toEqual({ available: true, username: "juani" });
    expect(new URL((fetchMock.mock.calls[0]![0] as Request).url).pathname).toBe("/usernames/juani");
  });

  it("propagates the invalid message", async () => {
    mockApi([[/^GET \/usernames\//, 400, { error: "El nombre de usuario puede tener letras, números, punto y guion bajo (3 a 30)." }]]);
    await expect(checkUsername("ab")).rejects.toThrow(/letras, números/);
  });
});

describe("uploadAvatar", () => {
  it("resizes to 512 px, asks for the upload URL, PUTs the JPEG and completes", async () => {
    const fetchMock = mockApi([
      [/^POST \/me\/avatar$/, 200, { upload: "https://r2.test/put", expiresIn: 600 }],
      [/^POST \/me\/avatar\/complete$/, 200, user],
    ]);
    const upload = jest.spyOn(File.prototype, "upload");

    const result = await uploadAvatar({ uri: "file:///picked.jpg", width: 1200, height: 1200 });

    const manipulator = jest.requireMock("expo-image-manipulator").ImageManipulator.__ctx;
    expect(manipulator.resize).toHaveBeenCalledWith({ width: 512 });
    expect(upload).toHaveBeenCalledWith("https://r2.test/put", { httpMethod: "PUT", headers: { "Content-Type": "image/jpeg" } });
    expect(fetchMock.mock.calls.map((c) => `${(c[0] as Request).method} ${new URL((c[0] as Request).url).pathname}`)).toEqual([
      "POST /me/avatar",
      "POST /me/avatar/complete",
    ]);
    expect(result).toEqual(user);
  });

  it("declares the JPEG's exact byte size, since the URL is signed for that Content-Length", async () => {
    const fetchMock = mockApi([
      [/^POST \/me\/avatar$/, 200, { upload: "https://r2.test/put", expiresIn: 600 }],
      [/^POST \/me\/avatar\/complete$/, 200, user],
    ]);
    jest.spyOn(File.prototype, "size", "get").mockReturnValue(73_512);

    await uploadAvatar({ uri: "file:///picked.jpg", width: 1200, height: 1200 });

    expect(await (fetchMock.mock.calls[0]![0] as Request).json()).toEqual({ sizeBytes: 73_512 });
  });

  it("refuses a JPEG over 2 MB without asking for a URL", async () => {
    const fetchMock = mockApi([]);
    jest.spyOn(File.prototype, "size", "get").mockReturnValue(2 * 1024 * 1024 + 1);

    await expect(uploadAvatar({ uri: "file:///picked.jpg", width: 1200, height: 1200 })).rejects.toThrow("La foto es muy pesada");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates the server's message when it can't take the upload", async () => {
    mockApi([[/^POST \/me\/avatar$/, 503, { error: "Las subidas están en pausa. Probá más tarde." }]]);

    await expect(uploadAvatar({ uri: "file:///picked.jpg", width: 1200, height: 1200 })).rejects.toThrow("Las subidas están en pausa");
  });

  it("doesn't upscale a smaller photo", async () => {
    mockApi([
      [/^POST \/me\/avatar$/, 200, { upload: "https://r2.test/put", expiresIn: 600 }],
      [/^POST \/me\/avatar\/complete$/, 200, user],
    ]);
    const manipulator = jest.requireMock("expo-image-manipulator").ImageManipulator.__ctx;
    manipulator.resize.mockClear();

    await uploadAvatar({ uri: "file:///picked.jpg", width: 300, height: 300 });

    expect(manipulator.resize).not.toHaveBeenCalled();
  });

  it("fails with a readable message if the PUT is rejected, without completing", async () => {
    const fetchMock = mockApi([[/^POST \/me\/avatar$/, 200, { upload: "https://r2.test/put", expiresIn: 600 }]]);
    jest.spyOn(File.prototype, "upload").mockResolvedValueOnce({ status: 403, body: "" } as never);

    await expect(uploadAvatar({ uri: "file:///picked.jpg", width: 1200, height: 1200 })).rejects.toThrow("No se pudo subir la foto");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails with a readable message if the PUT has no connection", async () => {
    mockApi([[/^POST \/me\/avatar$/, 200, { upload: "https://r2.test/put", expiresIn: 600 }]]);
    jest.spyOn(File.prototype, "upload").mockRejectedValueOnce(new Error("offline"));

    await expect(uploadAvatar({ uri: "file:///picked.jpg", width: 1200, height: 1200 })).rejects.toThrow("No se pudo subir la foto");
  });
});
