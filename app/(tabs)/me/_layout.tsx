import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      {/* No visible title: the header (photo and name) already says whose profile it is. `title` stays for the back button and VoiceOver. */}
      <Stack.Screen name="index" options={{ title: "Perfil", headerTitle: "", headerLargeTitle: false }} />
      <Stack.Screen name="activity" options={{ title: "Tu actividad" }} />
      <Stack.Screen name="likes" options={{ title: "Me gusta" }} />
    </Stack>
  );
}
