// All the app's routes, for renderRouter with real navigation.
import AuthLayout from "../../app/(auth)/_layout";
import CodeScreen from "../../app/(auth)/code";
import EmailScreen from "../../app/(auth)/email";
import CompleteProfileScreen from "../../app/(auth)/profile";
import TabsLayout from "../../app/(tabs)/_layout";
import CameraTab from "../../app/(tabs)/camera";
import FriendsLayout from "../../app/(tabs)/friends/_layout";
import FriendsTab from "../../app/(tabs)/friends/index";
import FriendRequestsRoute from "../../app/(tabs)/friends/requests";
import FriendProfileRoute from "../../app/(tabs)/friends/user/[id]";
import MapLayout from "../../app/(tabs)/map/_layout";
import MapScreen from "../../app/(tabs)/map/index";
import RollLayout from "../../app/(tabs)/roll/_layout";
import RollScreen from "../../app/(tabs)/roll/index";
import MeLayout from "../../app/(tabs)/me/_layout";
import MeActivityScreen from "../../app/(tabs)/me/activity";
import MeLikesScreen from "../../app/(tabs)/me/likes";
import MeCommentsScreen from "../../app/(tabs)/me/comments";
import MeFeaturedByScreen from "../../app/(tabs)/me/featured-by";
import MeScreen from "../../app/(tabs)/me/index";
import RootLayout from "../../app/_layout";
import FriendLinkRoute from "../../app/friends/[code]";
import BlockedScreen from "../../app/blocked";
import AddFriendsScreen from "../../app/add-friends";
import CaptureScreen from "../../app/capture";
import CommentsRoute from "../../app/comments/[mediaId]";
import CreateScreen from "../../app/create";
import WorstCaseRoute from "../../app/dev/worst-case";
import CropAvatarScreen from "../../app/crop-avatar";
import EditProfileScreen from "../../app/edit-profile";
import IndexScreen from "../../app/index";
import InfoRoute from "../../app/info/[topic]";
import JoinScreen from "../../app/join";
import LoginLinkRoute from "../../app/login";
import MomentRoute from "../../app/moment";
import NotFound from "../../app/+not-found";
import NotificationsRoute from "../../app/notifications";
import OfflineMapsScreen from "../../app/offline-maps";
import PushPrimerRoute from "../../app/push-primer";
import PresentationScreen from "../../app/presentation";
import RevealRoute from "../../app/reveal";
import IntroRoute from "../../app/intro";
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
  "info/[topic]": InfoRoute,
  create: CreateScreen,
  "crop-avatar": CropAvatarScreen,
  trips: TripsScreen,
  "edit-profile": EditProfileScreen,
  settings: SettingsScreen,
  notifications: NotificationsRoute,
  blocked: BlockedScreen,
  "dev/worst-case": WorstCaseRoute,
  "add-friends": AddFriendsScreen,
  "friends/[code]": FriendLinkRoute,
  login: LoginLinkRoute,
  capture: CaptureScreen,
  moment: MomentRoute,
  "offline-maps": OfflineMapsScreen,
  "push-primer": PushPrimerRoute,
  presentation: PresentationScreen,
  reveal: RevealRoute,
  intro: IntroRoute,
  "roll-started": RollStartedScreen,
  "photo/[id]": PhotoRoute,
  "comments/[mediaId]": CommentsRoute,
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
  "(tabs)/friends/requests": FriendRequestsRoute,
  "(tabs)/friends/user/[id]": FriendProfileRoute,
  "(tabs)/me/_layout": MeLayout,
  "(tabs)/me/index": MeScreen,
  "(tabs)/me/activity": MeActivityScreen,
  "(tabs)/me/likes": MeLikesScreen,
  "(tabs)/me/comments": MeCommentsScreen,
  "(tabs)/me/featured-by": MeFeaturedByScreen,
};

