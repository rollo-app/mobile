import { Alert } from "react-native";
import { deleteAllRegions, toMB } from "@/features/map/offline";
import { describeOfflineMap } from "@/features/map/offline-status";
import { useOfflineMap } from "@/features/map/use-offline-map";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Button, Row, Screen, Section } from "@/ui/components";

/** Zones downloaded for use without signal (sheet), with a button to delete them. */
export default function OfflineMapsScreen() {
  const { state, packs, reload } = useOfflineMap();
  const { trips } = useActiveTrip();
  const nameOf = (tripId: string) => trips.find((t) => t.id === tripId)?.name ?? "Rollo";

  const confirmDelete = () =>
    Alert.alert("¿Borrar los mapas sin señal?", "Se vuelven a bajar solos mientras dure el rollo y haya conexión.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => void deleteAllRegions().then(reload),
      },
    ]);

  return (
    <Screen grouped>
      <Section
        title="Zonas"
        footer="Se bajan solos alrededor de donde estás y de donde sacaron fotos, y se borran una semana después de que termina el rollo."
      >
        <Row label="Estado" value={describeOfflineMap(state)} />
        {packs.map((p) => (
          <Row
            key={p.id}
            label={`${nameOf(p.tripId)} · ${p.kind === "wide" ? "Amplia" : "Detallada"}`}
            value={`${Math.max(1, Math.round(toMB(p.bytes)))} MB`}
          />
        ))}
      </Section>

      <Button label="Borrar mapas sin señal" variant="secondary" onPress={confirmDelete} disabled={packs.length === 0} />
    </Screen>
  );
}
