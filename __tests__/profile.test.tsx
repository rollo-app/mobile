import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";
import { queryClient } from "@/api/query-client";
import * as featuredActions from "@/features/featured/actions";
import * as friendActions from "@/features/friends/actions";
import * as profileActions from "@/features/profile/actions";
import { ProfileShowcase } from "@/features/profile/profile-showcase";
import * as actions from "@/features/trips/actions";
import { signInAs, tripSummary, USER } from "@/test/account";
import { BARILOCHE, CAMI, CHALTEN, featuredPhoto, JUANI } from "@/test/featured";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
const featured = jest.mocked(featuredActions);
const { __sourceProps: sourceProps, __layerProps: layerProps } = jest.requireMock("@maplibre/maplibre-react-native") as {
  __sourceProps: Record<string, any>;
  __layerProps: Record<string, any>;
};

const SUR = "11111111-1111-4111-8111-111111111111";
const BIO = "Viajando por el sur";

beforeEach(() => {
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(actions).fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  jest.mocked(actions).fetchTrip.mockReturnValue(new Promise(() => {}));
  jest.mocked(actions).fetchFeed.mockReturnValue(new Promise(() => {}));
  featured.fetchFeatured.mockReset().mockResolvedValue([]);
  featured.unfeatureMedia.mockReset().mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("Perfil", () => {
  it("shows your photo, name, handle and description, and no account settings", async () => {
    await signInAs({ user: { ...USER, bio: BIO }, trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText(BIO)).toBeVisible();
    expect(screen.getByText("@juani")).toBeVisible();
    expect(screen.getAllByText("Juani").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("avatar", { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Borrar cuenta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar perfil" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Mapa sin señal/ })).toBeNull();
  });

  it("shows how many friends you have and tapping it opens Amigos", async () => {
    jest.mocked(friendActions).fetchFriends.mockResolvedValue([{ id: "u2", name: "Cami", username: "cami", avatarUrl: null, bio: null }]);
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "1 amigo" }));

    await waitFor(() => expect(screen).toHavePathname("/friends"));
  });

  it("without friends there is no friend count line", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await screen.findByText("@juani");
    expect(screen.queryByRole("button", { name: /^\d+ amigos?/ })).toBeNull();
  });

  it.each([
    ["founder", "FOUNDER", "Insignia: Founder"],
    ["first_edition", "FIRST EDITION", "Insignia: First Edition"],
  ] as const)("shows the %s badge in your own header", async (badge, label, a11y) => {
    await signInAs({ user: { ...USER, badge }, trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText(label)).toBeVisible();
    expect(screen.getByLabelText(a11y)).toBeVisible();
  });

  it("shows no badge when there is none", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await screen.findByText("@juani");
    expect(screen.queryByText("FOUNDER")).toBeNull();
    expect(screen.queryByLabelText(/^Insignia/)).toBeNull();
  });

  it("without a description there is no empty text under the handle", async () => {
    await signInAs({ user: { ...USER, bio: null }, trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await screen.findByText("@juani");
    expect(screen.queryByTestId("profile-bio")).toBeNull();
  });

  it("the gear opens Ajustes with Editar perfil, Mapa sin señal, Cerrar sesión and Borrar cuenta", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Ajustes" }));

    expect(screen).toHavePathname("/settings");
    expect(await screen.findByRole("button", { name: "Editar perfil" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^Mapa sin señal/ })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Borrar cuenta" })).toBeVisible();
  });

  it("the segmented control switches between the empty Fotos and Mapa states", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/me" });

    const photos = "Cuando se revele un rollo, vas a poder elegir tus mejores fotos para mostrar acá.";
    const places = "Acá vas a ver las zonas donde sacaste tus fotos destacadas.";
    expect(await screen.findByText(photos)).toBeVisible();
    expect(screen.queryByText(places)).toBeNull();

    const showcase = within(screen.getByTestId("profile-showcase"));
    await fireEvent.press(showcase.getByRole("button", { name: "Mapa" }));
    expect(screen.getByText(places)).toBeVisible();
    expect(screen.queryByText(photos)).toBeNull();

    await fireEvent.press(showcase.getByRole("button", { name: "Fotos" }));
    expect(screen.getByText(photos)).toBeVisible();
  });
});

describe("Ajustes: Perfil público", () => {
  it("is off by default and explains who sees your profile", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    await renderRouter(routes, { initialUrl: "/settings" });

    const toggle = await screen.findByRole("switch", { name: "Perfil público" });
    expect(toggle.props.value).toBe(false);
    expect(screen.getByText("Si está apagado, solo tus amigos ven tus fotos destacadas y tu lista de amigos.")).toBeVisible();
  });

  it("turning it on saves profileVisibility public with PATCH /me", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    const update = jest.spyOn(profileActions, "updateProfile").mockResolvedValue({ ...USER, profileVisibility: "public" });
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent(await screen.findByRole("switch", { name: "Perfil público" }), "valueChange", true);

    expect(update).toHaveBeenCalledWith({ profileVisibility: "public" });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Perfil público" }).props.value).toBe(true));
    expect(queryClient.getQueryData<typeof USER>(["me"])?.profileVisibility).toBe("public");
  });

  it("turning it off saves profileVisibility friends", async () => {
    await signInAs({ user: { ...USER, profileVisibility: "public" }, trips: [tripSummary(SUR, "Viaje al sur")] });
    const update = jest.spyOn(profileActions, "updateProfile").mockResolvedValue({ ...USER, profileVisibility: "friends" });
    await renderRouter(routes, { initialUrl: "/settings" });

    const toggle = await screen.findByRole("switch", { name: "Perfil público" });
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, "valueChange", false);

    expect(update).toHaveBeenCalledWith({ profileVisibility: "friends" });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Perfil público" }).props.value).toBe(false));
  });

  it("if saving fails it shows the error inline and the switch goes back", async () => {
    await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
    jest.spyOn(profileActions, "updateProfile").mockRejectedValue(new Error("No hay conexión"));
    await renderRouter(routes, { initialUrl: "/settings" });

    await fireEvent(await screen.findByRole("switch", { name: "Perfil público" }), "valueChange", true);

    expect(await screen.findByText("No hay conexión")).toBeVisible();
    expect(screen.getByRole("switch", { name: "Perfil público" }).props.value).toBe(false);
  });
});

describe("Editar perfil: descripción", () => {
  beforeEach(() => signInAs({ user: { ...USER, bio: "Hola" }, trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("is prefilled, counts characters and saves the description with PATCH /me", async () => {
    const update = jest.spyOn(profileActions, "updateProfile").mockResolvedValue({ ...USER, bio: BIO });
    await renderRouter(routes, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByRole("button", { name: "Editar perfil" }));

    const input = await screen.findByLabelText("Descripción");
    expect(input.props.value).toBe("Hola");
    expect(input.props.maxLength).toBe(150);
    expect(input.props.multiline).toBe(true);
    expect(screen.getByText("4/150")).toBeVisible();

    await fireEvent.changeText(input, BIO);
    expect(screen.getByText(`${BIO.length}/150`)).toBeVisible();
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen).toHavePathname("/settings"));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ bio: BIO }));
  });

  it("shows the server's error inline and keeps the text", async () => {
    jest.spyOn(profileActions, "updateProfile").mockRejectedValue(new Error("La descripción puede tener hasta 3 renglones"));
    await renderRouter(routes, { initialUrl: "/edit-profile" });

    const input = await screen.findByLabelText("Descripción");
    await fireEvent.changeText(input, "uno\ndos\ntres\ncuatro");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("La descripción puede tener hasta 3 renglones")).toBeVisible();
    expect(screen.getByLabelText("Descripción").props.value).toBe("uno\ndos\ntres\ncuatro");
    expect(screen).toHavePathname("/edit-profile");
  });

  it("is not part of Completá tu perfil", async () => {
    await signInAs({ user: { ...USER, name: null } });
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByText("Completá tu perfil")).toBeVisible();
    expect(screen.queryByLabelText("Descripción")).toBeNull();
  });
});

const showcase = () => within(screen.getByTestId("profile-showcase"));

describe("Perfil: fotos destacadas", () => {
  beforeEach(() => signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] }));

  it("shows your featured photos in a grid, with the author's badge only on the ones you didn't take", async () => {
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p1"), featuredPhoto("p2", { author: CAMI }), featuredPhoto("p3")]);
    await renderRouter(routes, { initialUrl: "/me" });

    const byCami = await showcase().findByRole("button", { name: "Foto de Cami" });
    expect(featured.fetchFeatured).toHaveBeenCalledWith("u1");
    expect(showcase().getAllByRole("button", { name: "Foto destacada" })).toHaveLength(2);
    expect(within(byCami).getByTestId("featured-author").props.accessibilityLabel).toBe("Foto de Cami");
    expect(showcase().getAllByTestId("featured-author")).toHaveLength(1);
    expect(screen.queryByText("Cuando se revele un rollo, vas a poder elegir tus mejores fotos para mostrar acá.")).toBeNull();
  });

  it("tapping a photo opens the featured viewer", async () => {
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p1"), featuredPhoto("p2", { author: CAMI })]);
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await showcase().findByRole("button", { name: "Foto de Cami" }));

    await waitFor(() => expect(screen).toHavePathname("/featured/u1/p2"));
  });

  it("Mapa shows one circle per zone (photos without a zone left out), never a pin per photo", async () => {
    featured.fetchFeatured.mockResolvedValue([
      featuredPhoto("p1"),
      featuredPhoto("p2", { author: CAMI }),
      featuredPhoto("p3", { zone: CHALTEN }),
      featuredPhoto("p4", { zone: null }),
    ]);
    await renderRouter(routes, { initialUrl: "/me" });
    await showcase().findByRole("button", { name: "Foto de Cami" });

    await fireEvent.press(showcase().getByRole("button", { name: "Mapa" }));

    const zones = showcase().getAllByLabelText(/^pin zone:/);
    expect(zones.map((z) => z.props.accessibilityLabel).sort()).toEqual([
      `pin zone:${BARILOCHE.lat},${BARILOCHE.lng}`,
      `pin zone:${CHALTEN.lat},${CHALTEN.lng}`,
    ]);
    expect(showcase().queryByLabelText(/^pin p\d/)).toBeNull();
  });

  it("Mapa merges nearby zones when zooming out, showing the sum of their photos", async () => {
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p1"), featuredPhoto("p2"), featuredPhoto("p3", { zone: CHALTEN })]);
    await renderRouter(routes, { initialUrl: "/me" });
    await showcase().findAllByRole("button", { name: "Foto destacada" });

    await fireEvent.press(showcase().getByRole("button", { name: "Mapa" }));

    const source = sourceProps["featured-zones"];
    expect(source.cluster).toBe(true);
    expect(source.clusterRadius).toBeGreaterThan(0);
    expect(source.clusterProperties).toEqual({ total: ["+", ["get", "count"]] });
    const shown = ["coalesce", ["get", "total"], ["get", "count"]];
    expect(layerProps["featured-zones-count"].layout["text-field"]).toEqual(["to-string", shown]);
    expect(layerProps["featured-zones-circle"].paint["circle-radius"][1]).toEqual(shown);
  });

  it("Mapa without zones shows its empty state", async () => {
    featured.fetchFeatured.mockResolvedValue([featuredPhoto("p1", { zone: null })]);
    await renderRouter(routes, { initialUrl: "/me" });
    await showcase().findByRole("button", { name: "Foto destacada" });

    await fireEvent.press(showcase().getByRole("button", { name: "Mapa" }));

    expect(screen.getByText("Acá vas a ver las zonas donde sacaste tus fotos destacadas.")).toBeVisible();
  });

  it("a load error shows the message and Reintentar loads them again", async () => {
    featured.fetchFeatured.mockRejectedValueOnce(new Error("No hay conexión")).mockResolvedValue([featuredPhoto("p1")]);
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await showcase().findByText("No hay conexión")).toBeVisible();
    await fireEvent.press(showcase().getByRole("button", { name: "Reintentar" }));

    expect(await showcase().findByRole("button", { name: "Foto destacada" })).toBeVisible();
    expect(featured.fetchFeatured).toHaveBeenCalledTimes(2);
  });

  it("on a friend's profile the badge shows on the photos the friend didn't take", async () => {
    jest.mocked(friendActions).fetchFriend.mockResolvedValue({ friend: { ...CAMI, bio: null }, commonTrips: [] });
    jest.spyOn(profileActions, "fetchUser").mockResolvedValue({ user: { ...CAMI, bio: null, badge: null }, isFriend: true, blockedByMe: false, reportedByMe: false, profileVisibility: "friends", canSee: true, friendCount: 0, mutualCount: 0 });
    featured.fetchFeatured.mockImplementation(async (userId) =>
      userId === "u2"
        ? [
            featuredPhoto("p1", {}, "u2"),
            featuredPhoto("p2", { author: JUANI }, "u2"),
          ]
        : [],
    );
    await renderRouter(routes, { initialUrl: "/friends/user/u2" });

    const friendShowcase = await waitFor(() => {
      const found = screen.getAllByTestId("profile-showcase").find((s) => within(s).queryByRole("button", { name: "Foto de Juani" }));
      expect(found).toBeTruthy();
      return within(found!);
    });
    expect(featured.fetchFeatured).toHaveBeenCalledWith("u2");
    expect(friendShowcase.getAllByTestId("featured-author")).toHaveLength(1);
    expect(friendShowcase.getByRole("button", { name: "Foto destacada" })).toBeVisible();

    await fireEvent.press(friendShowcase.getByRole("button", { name: "Foto de Juani" }));
    await waitFor(() => expect(screen).toHavePathname("/featured/u2/p2"));
  });

  it("without permission it says the profile is private and asks for nothing", async () => {
    await renderRouter(
      {
        index: () => (
          <QueryClientProvider client={queryClient}>
            <ProfileShowcase own={false} userId="u2" canSee={false} />
          </QueryClientProvider>
        ),
      },
      { initialUrl: "/" },
    );

    expect(await screen.findByText("Este perfil es privado")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Mapa" })).toBeNull();
    expect(featured.fetchFeatured).not.toHaveBeenCalled();
  });
});
