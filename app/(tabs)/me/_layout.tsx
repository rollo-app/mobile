import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Perfil", headerLargeTitle: true }} />
      <Stack.Screen name="activity" options={{ title: "Tu actividad" }} />
      <Stack.Screen name="likes" options={{ title: "Me gusta" }} />
    </Stack>
  );
}
