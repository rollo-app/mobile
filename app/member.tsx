import { useLocalSearchParams } from "expo-router";
import { MemberCardScreen } from "@/features/roll/member-card-screen";

/** A member's card (form sheet): photo, name, role, "Ver perfil" and the role actions you may use. */
export default function MemberRoute() {
  const { tripId, memberId } = useLocalSearchParams<{ tripId: string; memberId: string }>();
  return <MemberCardScreen tripId={tripId} memberId={memberId} />;
}
