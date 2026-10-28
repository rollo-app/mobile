import { useLocalSearchParams } from "expo-router";
import { EmailScreen } from "@/features/auth/email-screen";

export default function EmailRoute() {
  // Prefilled when coming back from a dead magic link.
  const { email } = useLocalSearchParams<{ email?: string | string[] }>();
  return <EmailScreen initialEmail={typeof email === "string" ? email : ""} />;
}
