import { router } from "expo-router";
import { useState } from "react";
import { joinTrip } from "@/features/trips/actions";
import { Button, ErrorText, Field, Footnote, Screen } from "@/ui/components";

export default function JoinScreen() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = code.trim().length === 6 && name.trim().length > 0;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await joinTrip({ code, name });
      router.dismissTo("/roll");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar al viaje");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen grouped>
      <Footnote>Pedile el código a quien creó el viaje.</Footnote>

      <Field
        label="Código del viaje"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="HUB5FT"
      />
      <Field label="Tu nombre" value={name} onChangeText={setName} maxLength={30} placeholder="Como te conocen" />

      {error && <ErrorText>{error}</ErrorText>}

      <Button label="Unirme" onPress={submit} disabled={!valid} loading={loading} />
    </Screen>
  );
}
