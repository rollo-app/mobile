import { useLocalSearchParams } from "expo-router";
import { MembersScreen } from "@/features/roll/members-screen";

/** Everyone in a roll ("Ver todos" in "En el rollo"). */
export default function RollMembersRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <MembersScreen tripId={tripId} />;
}
