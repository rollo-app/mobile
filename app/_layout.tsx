import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/ui/theme";

export default function RootLayout() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Rollo" }} />
        <Stack.Screen name="create" options={{ title: "Nuevo viaje" }} />
        <Stack.Screen name="join" options={{ title: "Unirme" }} />
        <Stack.Screen name="trip/[id]" options={{ title: "" }} />
      </Stack>
    </>
  );
}
