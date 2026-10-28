import { useLocalSearchParams } from "expo-router";
import { MagicLinkScreen } from "@/features/auth/magic-link-screen";

/** Deep link `rollo://login?token=…&email=…` or the Universal Link `https://rollo.juanifraga.com/entrar#t=…&e=…` (mapped by `+native-intent`) from the login email; reachable with or without a session. */
export default function LoginLinkRoute() {
  const { token, email } = useLocalSearchParams<{ token?: string | string[]; email?: string | string[] }>();
  // A repeated param is ambiguous: treat the link as invalid rather than pick one.
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  return <MagicLinkScreen token={one(token)} email={one(email)} />;
}
