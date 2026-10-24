import { useLocalSearchParams } from "expo-router";
import { CodeScreen } from "@/features/auth/code-screen";

export default function CodeRoute() {
  const { email } = useLocalSearchParams<{ email: string }>();
  return <CodeScreen email={email} />;
}
