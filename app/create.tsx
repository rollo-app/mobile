import { router } from "expo-router";
import { useState } from "react";
import { createTrip } from "@/features/trips/actions";
import { Button, ErrorText, Field, Footnote, Screen } from "@/ui/components";

const MAX_DAYS = 60;

export default function CreateScreen() {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dayCount = Number(days);
  const valid =
    name.trim().length > 0 &&
    adminName.trim().length > 0 &&
    Number.isInteger(dayCount) &&
    dayCount >= 1 &&
    dayCount <= MAX_DAYS;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await createTrip({
        name,
        adminName,
        days: dayCount,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.dismissTo("/rollo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el viaje");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen grouped>
      <Footnote>Arranca hoy y se revela cuando termina el viaje.</Footnote>

      <Field label="Nombre del viaje" value={name} onChangeText={setName} maxLength={60} placeholder="Viaje al sur" />
      <Field label="Tu nombre" value={adminName} onChangeText={setAdminName} maxLength={30} placeholder="Como te conocen" />
      <Field label="Días de viaje" value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={2} />

      {error && <ErrorText>{error}</ErrorText>}

      <Button label="Crear viaje" onPress={submit} disabled={!valid} loading={loading} />
    </Screen>
  );
}
