import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { useSyncTriggers } from "@/features/capture/use-sync-triggers";

export default function RootLayout() {
  const scheme = useColorScheme();
  useSyncTriggers();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: "Abrí un rollo", headerLargeTitle: true }} />
        <Stack.Screen name="join" options={{ title: "Sumate a un rollo", headerLargeTitle: true }} />
        <Stack.Screen
          name="trips"
          options={{
            title: "Tus viajes",
            presentation: "formSheet",
            sheetAllowedDetents: [0.5, 1],
            sheetGrabberVisible: true,
          }}
        />
        <Stack.Screen name="capture" options={{ presentation: "fullScreenModal", headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
