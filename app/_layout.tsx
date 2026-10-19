import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { CACHE_MAX_AGE, connectAppState, persister, queryClient } from "@/api/query-client";
import "@/features/capture/background-upload"; // defines the background task at module level
import { useSyncTriggers } from "@/features/capture/use-sync-triggers";

export default function RootLayout() {
  const scheme = useColorScheme();
  useSyncTriggers();
  useEffect(() => connectAppState(), []);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: CACHE_MAX_AGE }}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="create" options={{ title: "Nuevo rollo", headerLargeTitle: true }} />
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
          <Stack.Screen
            name="rename"
            options={{
              title: "Tu nombre",
              presentation: "formSheet",
              sheetAllowedDetents: [0.3, 0.5],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="capture" options={{ presentation: "fullScreenModal", headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
