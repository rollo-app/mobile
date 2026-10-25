import { router } from "expo-router";
import { Row, Section } from "@/ui/components";
import { useFriendRequests } from "./use-friend-requests";

/** "Solicitudes" row in the Amigos tab: the count and a way into the full list. Nothing if none. */
export function FriendRequestsRow() {
  const { requests } = useFriendRequests();
  if (!requests || requests.length === 0) return null;
  return (
    <Section>
      <Row label="Solicitudes" value={String(requests.length)} onPress={() => router.push("/friends/requests")} />
    </Section>
  );
}
