import { Redirect } from "expo-router";
import { gateFor } from "@/features/auth/gate";
import { useMe } from "@/features/auth/use-me";
import { useActiveTrip } from "@/features/trips/use-active-trip";

export default function IndexScreen() {
  const { session, me, failed } = useMe();
  const gate = gateFor({ session, me, meFailed: failed });
  if (gate === "login") return <Redirect href="/email" />;
  if (gate === "profile") return <Redirect href="/profile" />;
  if (gate !== "app") return null;
  return <Home />;
}

function Home() {
  const { loaded } = useActiveTrip();
  if (!loaded) return null;
  // With or without rollos, the Rollo tab is the home: with none it's the welcome.
  return <Redirect href="/roll" />;
}
