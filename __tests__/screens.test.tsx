import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { queryClient } from "@/api/query-client";
import { createQueue, type Queue, type QueuedMedia } from "@/features/capture/queue";
import * as actions from "@/features/trips/actions";
import { listTrips, saveSession, updateMemberName } from "@/storage/trips";
import { memoryDb } from "@/test/sqlite-memory";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
const mocked = jest.mocked(actions);
const { getQueue } = jest.requireMock("@/features/capture/store") as { getQueue: jest.Mock };

const DAY = 24 * 60 * 60 * 1000;
const SUR = "11111111-1111-4111-8111-111111111111";
const BARILOCHE = "33333333-3333-4333-8333-333333333333";

const trip = (overrides: Partial<actions.Trip> = {}): actions.Trip => ({
  id: SUR,
  name: "Viaje al sur",
  joinCode: "HUB5FT",
  timezone: "America/Argentina/Buenos_Aires",
  startsAt: Date.now() - 2 * DAY,
  endsAt: Date.now() + 9 * DAY,
  revealAt: Date.now() + 9 * DAY,
  revealed: false,
  dailyPhotoLimit: 10,
  dailyVideoLimit: 3,
  ...overrides,
});

const detail = (overrides: Partial<actions.TripDetail> = {}): actions.TripDetail => ({
  trip: trip(),
  me: { id: "m1", name: "Juani", role: "admin" },
  members: [
    { id: "m1", name: "Juani", role: "admin" },
    { id: "m2", name: "Fede", role: "member" },
  ],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 12,
  ...overrides,
});

const saveTrip = (tripId: string, tripName: string) =>
  saveSession({ tripId, tripName, joinCode: "HUB5FT", memberId: "m1", memberName: "Juani", role: "admin", token: "t" });

describe("Home", () => {
  it("with no trips it invites you to start a roll or join", async () => {
    await renderRouter(routes, { initialUrl: "/" });

    expect(await screen.findByRole("button", { name: "Empezar un nuevo rollo" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sumate con un código" })).toBeVisible();
  });

  it("the buttons lead to create and join", async () => {
    await renderRouter(routes, { initialUrl: "/" });

    await fireEvent.press(await screen.findByRole("button", { name: "Sumate con un código" }));
    expect(screen).toHavePathname("/join");
  });

  it("with saved trips it opens the roll of the last one you opened", async () => {
    await saveTrip(SUR, "Viaje al sur");
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/" });

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(await screen.findByText("7 de 10")).toBeVisible();
    expect(mocked.fetchTrip).toHaveBeenCalledWith(SUR);
  });
});

describe("Roll", () => {
  beforeEach(() => saveTrip(SUR, "Viaje al sur"));

  it("shows how much is in the roll, what you have left today and when it is revealed", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByLabelText("12 en el rollo")).toBeVisible();
    expect(screen.getByText("7 de 10")).toBeVisible();
    expect(screen.getByText("2 de 3")).toBeVisible();
    expect(screen.getByText("en 9 días")).toBeVisible();
  });

  it("the contact sheet shows each photo's ThumbHash, newest to oldest", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 2 }));
    mocked.fetchFeed.mockResolvedValue({
      revealed: false,
      revealAt: Date.now() + 9 * DAY,
      items: [
        { id: "a", type: "photo", takenAt: 1, day: "2027-01-01", lat: null, lng: null, caption: null, thumbhash: "vieja", durationS: null, author: { id: "m", name: "Fede" } },
        { id: "b", type: "photo", takenAt: 2, day: "2027-01-01", lat: null, lng: null, caption: null, thumbhash: "nueva", durationS: null, author: { id: "m", name: "Fede" } },
      ],
    });
    await renderRouter(routes, { initialUrl: "/roll" });

    await screen.findByLabelText("2 en el rollo");
    const frames = await screen.findAllByTestId(/^thumbhash-/);
    const hashes = frames.map((n) => n.props.testID);
    expect(hashes).toEqual(["thumbhash-nueva", "thumbhash-vieja"]);
  });

  it("if loading fails it shows the error", async () => {
    mocked.fetchTrip.mockRejectedValue(new Error("Sin conexión. Probá de nuevo cuando tengas señal."));
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByText("Sin conexión. Probá de nuevo cuando tengas señal.")).toBeVisible();
  });
});

describe("Roll with unuploaded photos", () => {
  let queue: Queue;
  const queued = (): QueuedMedia => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    tripId: SUR,
    type: "photo",
    takenAt: Date.now(),
    day: "2027-01-05",
    lat: null,
    lng: null,
    accuracyM: null,
    caption: null,
    durationS: null,
    width: 4000,
    height: 3000,
    sizeBytes: 1000,
    originalUri: "file:///docs/pending/a/original.jpg",
    thumbUri: "file:///docs/pending/a/thumb.jpg",
    thumbhash: null,
  });

  beforeEach(async () => {
    await saveTrip(SUR, "Viaje al sur");
    queue = await createQueue(memoryDb());
    getQueue.mockImplementation(() => Promise.resolve(queue));
  });

  it("counts your photos in the queue besides the server's", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 1 }));
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/roll" });

    expect(await screen.findByLabelText("2 en el rollo")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });

  it("once uploaded it stays at 2: the server adds it and the queue drops it, without double counting", async () => {
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 1 }));
    await queue.enqueue(queued());
    await renderRouter(routes, { initialUrl: "/roll" });
    expect(await screen.findByLabelText("2 en el rollo")).toBeVisible();

    // Same as the uploader does: remove it from the queue, then notify.
    mocked.fetchTrip.mockResolvedValue(detail({ totalUploaded: 2 }));
    await queue.remove(queued().id);
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["trip", SUR] });
      await queryClient.invalidateQueries({ queryKey: ["pending", SUR] });
    });

    expect(await screen.findByLabelText("2 en el rollo")).toBeVisible();
    expect(screen.queryByLabelText("3 en el rollo")).toBeNull();
  });
});

describe("Me", () => {
  beforeEach(() => saveTrip(SUR, "Viaje al sur"));

  it("shows the invite code and the members", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/me" });

    expect(await screen.findByText("HUB5FT")).toBeVisible();
    expect(screen.getByText("Fede")).toBeVisible();
  });

  it("from your trips the picker opens", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Tus viajes, 1" }));
    expect(screen).toHavePathname("/trips");
  });
});

describe("Your name", () => {
  beforeEach(() => saveTrip(SUR, "Viaje al sur"));

  it("from Me the sheet opens with your current name", async () => {
    mocked.fetchTrip.mockResolvedValue(detail());
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Juani, Admin" }));

    expect(screen).toHavePathname("/rename");
    expect(screen.getByLabelText("Tu nombre").props.value).toBe("Juani");
  });

  it("the Guardar button stays disabled if the name is empty or unchanged", async () => {
    await renderRouter(routes, { initialUrl: "/rename" });
    const input = await screen.findByLabelText("Tu nombre");
    await waitFor(() => expect(input.props.value).toBe("Juani"));

    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await fireEvent.changeText(input, "   ");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await fireEvent.changeText(input, "Juan");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("on save it closes the sheet and Me shows the new name", async () => {
    const renamed = detail({
      me: { id: "m1", name: "Juan", role: "admin" },
      members: [
        { id: "m1", name: "Juan", role: "admin" },
        { id: "m2", name: "Fede", role: "member" },
      ],
    });
    mocked.fetchTrip.mockResolvedValueOnce(detail()).mockResolvedValue(renamed);
    mocked.renameMe.mockImplementation((tripId, name) => updateMemberName(tripId, name));
    await renderRouter(routes, { initialUrl: "/me" });

    await fireEvent.press(await screen.findByRole("button", { name: "Juani, Admin" }));
    const input = await screen.findByLabelText("Tu nombre");
    await waitFor(() => expect(input.props.value).toBe("Juani"));
    await fireEvent.changeText(input, "Juan");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen).toHavePathname("/me"));
    expect(mocked.renameMe).toHaveBeenCalledWith(SUR, "Juan");
    expect(await screen.findByRole("button", { name: "Juan, Admin" })).toBeVisible();
    // the member list also updates, without showing "loading" again
    await waitFor(() => expect(screen.getAllByText("Juan")).toHaveLength(2));
    expect(screen.queryByText("Juani")).toBeNull();
  });

  it("if the server rejects it, it shows the error and leaves the sheet open", async () => {
    mocked.renameMe.mockRejectedValue(new Error("Ya hay alguien con ese nombre en el viaje"));
    await renderRouter(routes, { initialUrl: "/rename" });
    const input = await screen.findByLabelText("Tu nombre");
    await waitFor(() => expect(input.props.value).toBe("Juani"));

    await fireEvent.changeText(input, "Fede");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Ya hay alguien con ese nombre en el viaje")).toBeVisible();
    expect(screen).toHavePathname("/rename");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
  });
});

describe("Trip picker", () => {
  it("lists your trips and choosing one makes it the active one", async () => {
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await saveTrip(BARILOCHE, "Bariloche");
    await saveTrip(SUR, "Viaje al sur");
    await renderRouter(routes, { initialUrl: "/trips" });

    await fireEvent.press(await screen.findByRole("button", { name: "Bariloche" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect((await listTrips())[0]!.tripName).toBe("Bariloche");
  });

  it("has shortcuts to start a roll or join", async () => {
    await saveTrip(SUR, "Viaje al sur");
    await renderRouter(routes, { initialUrl: "/trips" });

    await fireEvent.press(await screen.findByRole("button", { name: "Empezar un nuevo rollo" }));
    expect(screen).toHavePathname("/create");
  });
});

describe("Join", () => {
  it("the button stays disabled until there is a 6-character code and a name", async () => {
    await renderRouter(routes, { initialUrl: "/join" });
    const button = await screen.findByRole("button", { name: "Unirme" });

    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Código del viaje"), "hub5f");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Fede");
    expect(button).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText("Código del viaje"), "hub5ft");
    expect(button).toBeEnabled();
  });

  it("joining goes to the roll", async () => {
    mocked.joinTrip.mockImplementation(async () => {
      await saveTrip(SUR, "Viaje al sur");
      return trip();
    });
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del viaje"), "hub5ft");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Fede");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mocked.joinTrip).toHaveBeenCalledWith({ code: "hub5ft", name: "Fede" });
  });

  it("shows the server error", async () => {
    mocked.joinTrip.mockRejectedValue(new Error("Código inválido"));
    await renderRouter(routes, { initialUrl: "/join" });

    await fireEvent.changeText(await screen.findByLabelText("Código del viaje"), "ZZZZZZ");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Fede");
    await fireEvent.press(screen.getByRole("button", { name: "Unirme" }));

    expect(await screen.findByText("Código inválido")).toBeVisible();
    expect(screen).toHavePathname("/join");
  });
});

describe("Create trip", () => {
  it("asks for the trip name, your name and days", async () => {
    await renderRouter(routes, { initialUrl: "/create" });
    const button = await screen.findByRole("button", { name: "Crear viaje" });

    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Nombre del viaje"), "Viaje al sur");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    expect(button).toBeEnabled();

    await fireEvent.changeText(screen.getByLabelText("Días de viaje"), "0");
    expect(button).toBeDisabled();
  });

  it("creates the trip with the phone's time zone and goes to the roll", async () => {
    mocked.createTrip.mockImplementation(async () => {
      await saveTrip(SUR, "Viaje al sur");
      return trip();
    });
    mocked.fetchTrip.mockReturnValue(new Promise(() => {}));
    await renderRouter(routes, { initialUrl: "/create" });

    await fireEvent.changeText(await screen.findByLabelText("Nombre del viaje"), "Viaje al sur");
    await fireEvent.changeText(screen.getByLabelText("Tu nombre"), "Juani");
    await fireEvent.changeText(screen.getByLabelText("Días de viaje"), "10");
    await fireEvent.press(screen.getByRole("button", { name: "Crear viaje" }));

    await waitFor(() => expect(screen).toHavePathname("/roll"));
    expect(mocked.createTrip).toHaveBeenCalledWith({
      name: "Viaje al sur",
      adminName: "Juani",
      days: 10,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });
});
