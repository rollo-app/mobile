import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Amigos", headerLargeTitle: true }} />
      {/* The title is the friend's name, set by the screen once it loads. */}
      <Stack.Screen name="user/[id]" options={{ title: "" }} />
    </Stack>
  );
}
