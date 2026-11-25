import { Stack } from "expo-router";

export const unstable_settings = { anchor: "index" };

// Each roll's screen sets its own title (the roll's name); "Rollos" is the list's.
export default function Layout() {
  return <Stack screenOptions={{ title: "Rollos" }} />;
}
