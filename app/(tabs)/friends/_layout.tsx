import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Amigos", headerLargeTitle: true }} />
      {/* No title: the name is already in the profile's header. */}
      <Stack.Screen name="user/[id]" options={{ title: "" }} />
    </Stack>
  );
}
