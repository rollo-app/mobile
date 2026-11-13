import { useLocalSearchParams } from "expo-router";
import { QrScreen } from "@/features/events/qr-screen";

/** The event's join link as a QR, for organizers. */
export default function EventQrRoute() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <QrScreen tripId={tripId} />;
}
