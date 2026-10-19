import { router } from "expo-router";
import { useEffect, useState } from "react";
import { renameMe } from "@/features/trips/actions";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { Button, ErrorText, Field, Screen } from "@/ui/components";

/** Editar tu nombre en el viaje activo (sheet). */
export default function RenameScreen() {
  const { trip } = useActiveTrip();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const current = trip?.memberName;
  useEffect(() => {
    if (current !== undefined) setName((prev) => prev || current);
  }, [current]);

  const trimmed = name.trim();
  const valid = !!trip && trimmed.length > 0 && trimmed !== current;

  async function submit() {
    if (!trip) return;
    setError(null);
    setLoading(true);
    try {
      await renameMe(trip.tripId, trimmed);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el nombre");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen grouped>
      <Field label="Tu nombre" value={name} onChangeText={setName} maxLength={30} placeholder="Como te conocen" />

      {error && <ErrorText>{error}</ErrorText>}

      <Button label="Guardar" onPress={submit} disabled={!valid} loading={loading} />
    </Screen>
  );
}
