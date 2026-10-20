// All the app's routes, for renderRouter with real navigation.
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
import DevTokenScreen from "../../app/dev-token";
import IndexScreen from "../../app/index";
import JoinScreen from "../../app/join";
import PhotoRoute from "../../app/photo/[id]";
import RenameScreen from "../../app/rename";
import TripsScreen from "../../app/trips";


export const routes = {
  _layout: RootLayout,
  index: IndexScreen,
  join: JoinScreen,
  create: CreateScreen,
  trips: TripsScreen,
  rename: RenameScreen,
  "dev-token": DevTokenScreen,
  capture: CaptureScreen,
  "photo/[id]": PhotoRoute,
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

