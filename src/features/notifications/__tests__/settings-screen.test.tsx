import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchNotificationSettings, updateNotificationSettings, type NotificationSettings } from "../actions";
import { NotificationSettingsScreen } from "../settings-screen";

jest.mock("../actions");
jest.mock("../use-push-permission", () => ({ usePushPermission: () => ({ permission: "granted", enable: jest.fn() }) }));
jest.mock("@/features/moments/moment-sync", () => ({ cancelMomentNotifications: jest.fn(), syncMoments: jest.fn() }));

const fetchMock = jest.mocked(fetchNotificationSettings);
const updateMock = jest.mocked(updateNotificationSettings);

const ALL_ON = {
  addedToTrip: true,
  tripStarted: true,
  tripRevealed: true,
  originalsExpiring: true,
  contestResult: true,
  newFriend: true,
  friendRequest: true,
  photoFeatured: true,
  photoLiked: true,
  photoCommented: true,
  dailyMoment: true,
  momentPosted: true,
} as NotificationSettings;

describe("NotificationSettingsScreen: contest", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    fetchMock.mockResolvedValue(ALL_ON);
    updateMock.mockResolvedValue({ ...ALL_ON, contestResult: false });
  });
  afterEach(() => client.clear());

  it("shows a 'Concurso de fotos' switch that saves only contestResult", async () => {
    await render(
      <QueryClientProvider client={client}>
        <NotificationSettingsScreen />
      </QueryClientProvider>,
    );
    const row = await screen.findByLabelText("Concurso de fotos");
    await fireEvent(row, "valueChange", false);
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ contestResult: false }));
  });
});
