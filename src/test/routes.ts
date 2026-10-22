// All the app's routes, for renderRouter with real navigation.
import AuthLayout from "../../app/(auth)/_layout";
import CodeScreen from "../../app/(auth)/code";
import EmailScreen from "../../app/(auth)/email";
import CompleteProfileScreen from "../../app/(auth)/profile";
import TabsLayout from "../../app/(tabs)/_layout";
import CameraTab from "../../app/(tabs)/camera";
import FriendsLayout from "../../app/(tabs)/friends/_layout";
import FriendsTab from "../../app/(tabs)/friends/index";
import FriendProfileRoute from "../../app/(tabs)/friends/user/[id]";
import MapLayout from "../../app/(tabs)/map/_layout";
import MapScreen from "../../app/(tabs)/map/index";
import RollLayout from "../../app/(tabs)/roll/_layout";
import RollScreen from "../../app/(tabs)/roll/index";
import MeLayout from "../../app/(tabs)/me/_layout";
import MeScreen from "../../app/(tabs)/me/index";
import RootLayout from "../../app/_layout";
import FriendLinkRoute from "../../app/friends/[code]";
import AddFriendsScreen from "../../app/add-friends";
import CaptureScreen from "../../app/capture";
import CreateScreen from "../../app/create";
import EditProfileScreen from "../../app/edit-profile";
import IndexScreen from "../../app/index";
import JoinScreen from "../../app/join";
import NotFound from "../../app/+not-found";
import NotificationsRoute from "../../app/notifications";
import OfflineMapsScreen from "../../app/offline-maps";
import PushPrimerRoute from "../../app/push-primer";
import PresentationScreen from "../../app/presentation";
import RevealRoute from "../../app/reveal";
import RollStartedScreen from "../../app/roll-started";
import PhotoRoute from "../../app/photo/[id]";
import FeaturedRoute from "../../app/featured/[userId]/[mediaId]";
import SettingsScreen from "../../app/settings";
import TripsScreen from "../../app/trips";
import UserProfileRoute from "../../app/user/[id]";
import UserFriendsRoute from "../../app/user/[id]/friends";


export const routes = {
  _layout: RootLayout,
  index: IndexScreen,
  "+not-found": NotFound,
  join: JoinScreen,
  create: CreateScreen,
  trips: TripsScreen,
  "edit-profile": EditProfileScreen,
  settings: SettingsScreen,
  notifications: NotificationsRoute,
  "add-friends": AddFriendsScreen,
  "friends/[code]": FriendLinkRoute,
  capture: CaptureScreen,
  "offline-maps": OfflineMapsScreen,
  "push-primer": PushPrimerRoute,
  presentation: PresentationScreen,
  reveal: RevealRoute,
  "roll-started": RollStartedScreen,
  "photo/[id]": PhotoRoute,
  "featured/[userId]/[mediaId]": FeaturedRoute,
  "user/[id]": UserProfileRoute,
  "user/[id]/friends": UserFriendsRoute,
  "(auth)/_layout": AuthLayout,
  "(auth)/email": EmailScreen,
  "(auth)/code": CodeScreen,
  "(auth)/profile": CompleteProfileScreen,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/roll/_layout": RollLayout,
  "(tabs)/roll/index": RollScreen,
  "(tabs)/map/_layout": MapLayout,
  "(tabs)/map/index": MapScreen,
  "(tabs)/camera": CameraTab,
  "(tabs)/friends/_layout": FriendsLayout,
  "(tabs)/friends/index": FriendsTab,
  "(tabs)/friends/user/[id]": FriendProfileRoute,
  "(tabs)/me/_layout": MeLayout,
  "(tabs)/me/index": MeScreen,
};

