import { router } from "expo-router";
import { Row } from "@/ui/components";
import { describeOfflineMap } from "./offline-status";
import { useOfflineMap } from "./use-offline-map";

/** "Mapa sin señal" row in "Vos": the state of the automatic download. Tapping opens the zones. */
export function OfflineMapRow() {
  const { state } = useOfflineMap();
  return <Row label="Mapa sin señal" value={describeOfflineMap(state)} onPress={() => router.push("/offline-maps")} />;
}
