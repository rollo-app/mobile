// Todas las rutas de la app, para renderRouter con navegación real.
import TabsLayout from "../../app/(tabs)/_layout";
import CameraTab from "../../app/(tabs)/camara";
import FeedLayout from "../../app/(tabs)/feed/_layout";
import FeedScreen from "../../app/(tabs)/feed/index";
import MapLayout from "../../app/(tabs)/mapa/_layout";
import MapScreen from "../../app/(tabs)/mapa/index";
import RolloLayout from "../../app/(tabs)/rollo/_layout";
import RolloScreen from "../../app/(tabs)/rollo/index";
import VosLayout from "../../app/(tabs)/vos/_layout";
import VosScreen from "../../app/(tabs)/vos/index";
import RootLayout from "../../app/_layout";
import CaptureScreen from "../../app/capture";
import CreateScreen from "../../app/create";
import IndexScreen from "../../app/index";
import JoinScreen from "../../app/join";
import TripsScreen from "../../app/trips";


export const routes = {
  _layout: RootLayout,
  index: IndexScreen,
  join: JoinScreen,
  create: CreateScreen,
  trips: TripsScreen,
  capture: CaptureScreen,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/rollo/_layout": RolloLayout,
  "(tabs)/rollo/index": RolloScreen,
  "(tabs)/mapa/_layout": MapLayout,
  "(tabs)/mapa/index": MapScreen,
  "(tabs)/camara": CameraTab,
  "(tabs)/feed/_layout": FeedLayout,
  "(tabs)/feed/index": FeedScreen,
  "(tabs)/vos/_layout": VosLayout,
  "(tabs)/vos/index": VosScreen,
};

