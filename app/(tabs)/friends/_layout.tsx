import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      {/* Small title: the search magnifier (use-search-bar.ts) sits on the same line; a large title would put it above. */}
      <Stack.Screen name="index" options={{ title: "Amigos" }} />
      <Stack.Screen name="requests" options={{ title: "Solicitudes" }} />
      {/* No title: the name is already in the profile's header. */}
      <Stack.Screen name="user/[id]" options={{ title: "" }} />
    </Stack>
  );
}
