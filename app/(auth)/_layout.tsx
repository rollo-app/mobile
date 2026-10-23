import { Stack } from "expo-router";
import { gateFor } from "@/features/auth/gate";
import { useMe } from "@/features/auth/use-me";

/** Entry flow: email → code → complete profile. Which step is first depends on where the user is. */
export default function AuthLayout() {
  const { session, me, failed } = useMe();
  const gate = gateFor({ session, me, meFailed: failed });
  return (
    <Stack screenOptions={{ headerShown: false, headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Protected guard={gate === "login"}>
        <Stack.Screen name="email" />
        <Stack.Screen name="code" options={{ headerShown: true, title: "", headerTransparent: true }} />
      </Stack.Protected>
      <Stack.Protected guard={gate === "profile"}>
        <Stack.Screen name="profile" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
