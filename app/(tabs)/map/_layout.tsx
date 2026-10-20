import { Stack } from "expo-router";

// The screen sets the title: it's the selector with the active trip's name.
// The default is only for when there's no active trip yet (never the route name).
export default function Layout() {
  return <Stack screenOptions={{ title: "Mapa" }} />;
}
