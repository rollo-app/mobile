// All the app's routes, for renderRouter with real navigation.
import AuthLayout from "../../app/(auth)/_layout";
import CodeScreen from "../../app/(auth)/code";
import EmailScreen from "../../app/(auth)/email";
import CompleteProfileScreen from "../../app/(auth)/profile";
import TabsLayout from "../../app/(tabs)/_layout";
import CameraTab from "../../app/(tabs)/camera";
import FeedLayout from "../../app/(tabs)/feed/_layout";
import FeedScreen from "../../app/(tabs)/feed/index";
import MapLayout from "../../app/(tabs)/map/_layout";
import MapScreen from "../../app/(tabs)/map/index";
import RollLayout from "../../app/(tabs)/roll/_layout";
import RollScreen from "../../app/(tabs)/roll/index";
import MeLayout from "../../app/(tabs)/me/_layout";
import MeScreen from "../../app/(tabs)/me/index";
import RootLayout from "../../app/_layout";
import CaptureScreen from "../../app/capture";
import CreateScreen from "../../app/create";
import EditProfileScreen from "../../app/edit-profile";
import FriendsScreen from "../../app/friends";
import IndexScreen from "../../app/index";
import JoinScreen from "../../app/join";
import NotFound from "../../app/+not-found";
import OfflineMapsScreen from "../../app/offline-maps";
import PresentationScreen from "../../app/presentation";
import PhotoRoute from "../../app/photo/[id]";
import RollInfoScreen from "../../app/roll-info";
import TripsScreen from "../../app/trips";


export const routes = {
  _layout: RootLayout,
  index: IndexScreen,
  "+not-found": NotFound,
  join: JoinScreen,
  create: CreateScreen,
  trips: TripsScreen,
  "edit-profile": EditProfileScreen,
  friends: FriendsScreen,
  "roll-info": RollInfoScreen,
  capture: CaptureScreen,
  "offline-maps": OfflineMapsScreen,
  presentation: PresentationScreen,
  "photo/[id]": PhotoRoute,
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
  "(tabs)/feed/_layout": FeedLayout,
  "(tabs)/feed/index": FeedScreen,
  "(tabs)/me/_layout": MeLayout,
  "(tabs)/me/index": MeScreen,
};

