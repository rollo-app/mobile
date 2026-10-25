import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import * as featuredActions from "@/features/featured/actions";
import * as friendActions from "@/features/friends/actions";
import * as actions from "@/features/trips/actions";
import { INFO_TOPICS, type InfoTopicId } from "@/features/info/topics";
import { signInAs, tripSummary } from "@/test/account";
import { routes } from "@/test/routes";

jest.mock("@/features/trips/actions");
jest.mock("@/features/friends/actions");
jest.mock("@/features/featured/actions");
const mocked = jest.mocked(actions);

const SUR = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 60 * 60 * 1000;
const me = { id: "m1", userId: "u-m1", name: "Juani", username: null, avatarUrl: null, role: "admin" as const, blockedByMe: false };
const detail = (): actions.TripDetail => ({
  trip: {
    id: SUR, name: "Viaje al sur", joinCode: "HUB5FT", timezone: "America/Argentina/Buenos_Aires",
    startsAt: Date.now() - DAY, endsAt: Date.now() + 9 * DAY, revealAt: Date.now() + 9 * DAY, revealed: false,
    dailyPhotoLimit: 10, dailyVideoLimit: 3, featuringDisabled: false, photoLimitMode: "daily", totalPhotoLimit: null,
    momentMode: "off", momentWindowStart: 540, momentWindowEnd: 1380,
  },
  me,
  members: [me],
  today: { date: "2027-01-05", photosLeft: 7, videosLeft: 2 },
  totalUploaded: 1,
});

const buttonFor = (topic: InfoTopicId) =>
  screen.findByRole("button", { name: `Más información sobre ${INFO_TOPICS[topic].title.toLowerCase()}` });

async function opensSheet(url: string, topic: InfoTopicId) {
  await renderRouter(routes, { initialUrl: url });
  await fireEvent.press(await buttonFor(topic));
  expect(screen).toHavePathname(`/info/${topic}`);
  expect(await screen.findByText(INFO_TOPICS[topic].title)).toBeVisible();
  expect(screen.getByText(INFO_TOPICS[topic].body.split("\n\n")[0]!)).toBeVisible();
}

beforeEach(async () => {
  jest.mocked(friendActions).fetchFriends.mockResolvedValue([]);
  jest.mocked(friendActions).fetchFriendRequests.mockResolvedValue([]);
  jest.mocked(featuredActions).fetchFeatured.mockResolvedValue([]);
  jest.mocked(featuredActions).fetchPrivacySettings.mockResolvedValue({ allowFeaturing: true } as never);
  mocked.fetchMyTrips.mockResolvedValue({ trips: [tripSummary(SUR, "Viaje al sur")] });
  mocked.fetchTrip.mockResolvedValue(detail());
  mocked.fetchFeed.mockReturnValue(new Promise(() => {}));
  await signInAs({ trips: [tripSummary(SUR, "Viaje al sur")] });
});

describe("info buttons", () => {
  it.each<InfoTopicId>(["dates", "reveal", "quota", "moment", "momentWindow", "privateRollo"])(
    "Crear rollo: %s opens its sheet",
    (topic) => opensSheet("/create", topic),
  );

  it.each<InfoTopicId>(["publicProfile", "othersProfiles", "offlineMap"])("Ajustes: %s opens its sheet", (topic) =>
    opensSheet("/settings", topic),
  );

  it("the board's invite section opens the code sheet", () => opensSheet("/roll", "inviteCode"));

  it("the offline map info does not open the zones", async () => {
    await renderRouter(routes, { initialUrl: "/settings" });
    await fireEvent.press(await buttonFor("offlineMap"));
    expect(screen).not.toHavePathname("/offline-maps");
  });

  it("shows nothing for an unknown topic", async () => {
    await renderRouter(routes, { initialUrl: "/info/nope" });
    expect(screen.queryByRole("header")).toBeNull();
  });
});
