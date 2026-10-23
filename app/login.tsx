import { useLocalSearchParams } from "expo-router";
import { MagicLinkScreen } from "@/features/auth/magic-link-screen";

/** Deep link `rollo://login?token=…&email=…` from the login email; reachable with or without a session. */
export default function LoginLinkRoute() {
  const { token, email } = useLocalSearchParams<{ token?: string; email?: string }>();
  return <MagicLinkScreen token={token ?? ""} email={email ?? ""} />;
}
