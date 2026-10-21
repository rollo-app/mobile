import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { CACHE_MAX_AGE, connectAppState, persister, queryClient } from "@/api/query-client";
import "@/features/capture/background-upload"; // defines the background task at module level
import { useRevealTap } from "@/features/notifications/use-reveal-tap";
import { useOfflineMapSync } from "@/features/map/use-offline-map-sync";
import { useRedeemPendingFriend } from "@/features/friends/use-pending-friend";
import { useSyncTriggers } from "@/features/capture/use-sync-triggers";
import { gateFor } from "@/features/auth/gate";
import { signOut } from "@/features/auth/session";
import { useMe } from "@/features/auth/use-me";
import { Button } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";

export default function RootLayout() {
  const scheme = useColorScheme();
  useSyncTriggers();
  useOfflineMapSync();
  useRevealTap();
  useEffect(() => connectAppState(), []);
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: CACHE_MAX_AGE }}>
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        <RootStack />
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

/**
 * Nothing of the app is reachable without a session and a name: the gate shows the login, the
 * "Completá tu perfil" step or the app. A 401 anywhere clears the session and lands back on the login.
 */
function RootStack() {
  const { session, me, failed, refetch } = useMe();
  const gate = gateFor({ session, me, meFailed: failed });
  useRedeemPendingFriend(gate === "app");

  if (gate === "loading") return <View style={styles.splash} />;
  if (gate === "error") {
    return (
      <View style={styles.error}>
        <Text style={[type.body, { color: colors.secondaryLabel }]}>No pudimos cargar tu cuenta. Revisá tu conexión.</Text>
        <Button label="Reintentar" onPress={() => void refetch()} />
        <Button label="Cerrar sesión" variant="secondary" onPress={() => void signOut()} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      {/* Always available: "/" sends each state to its place, so any unmatched link ends up here too. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* A friend link works with or without a session: it routes to the right step itself. */}
      <Stack.Screen name="friends/[code]" options={{ headerShown: false }} />
      <Stack.Protected guard={gate === "login" || gate === "profile"}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === "app"}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="create" options={{ title: "Nuevo rollo", presentation: "modal" }} />
          <Stack.Screen name="join" options={{ title: "Sumate a un rollo", presentation: "modal" }} />
          <Stack.Screen
            name="trips"
            options={{
              title: "Tus rollos",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="add-friends"
            options={{
              title: "Sumar amigos",
              presentation: "formSheet",
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="settings" options={{ title: "Ajustes" }} />
          <Stack.Screen
            name="edit-profile"
            options={{
              title: "Editar perfil",
              presentation: "formSheet",
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="roll-info"
            options={{
              title: "Sobre el rollo",
              presentation: "formSheet",
              sheetAllowedDetents: [0.6, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen
            name="offline-maps"
            options={{
              title: "Mapa sin señal",
              presentation: "formSheet",
              sheetAllowedDetents: [0.5, 1],
              sheetGrabberVisible: true,
            }}
          />
          <Stack.Screen name="capture" options={{ presentation: "fullScreenModal", headerShown: false }} />
          <Stack.Screen
            name="presentation"
            options={{
              presentation: "transparentModal",
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: "transparent" },
            }}
          />
          <Stack.Screen
            name="photo/[id]"
            options={{ presentation: "fullScreenModal", headerShown: false, contentStyle: { backgroundColor: "#000000" } }}
          />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.background },
  error: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background },
});
