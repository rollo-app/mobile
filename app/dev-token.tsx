import { Redirect, router } from "expo-router";
import { useState } from "react";
import { joinWithToken } from "@/features/trips/actions";
import { markOpened } from "@/storage/trips";
import { Button, ErrorText, Field, Footnote, Screen } from "@/ui/components";

/** Dev only: enter a trip with its id and a token (sheet). In release builds the route redirects home. */
export default function DevTokenScreen() {
  const [tripId, setTripId] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  const valid = tripId.trim().length > 0 && token.trim().length > 0;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const trip = await joinWithToken(tripId, token);
      await markOpened(trip.id);
      router.dismissTo("/roll");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar al rollo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen grouped>
      <Footnote>Solo para desarrollo. Los valores salen de `npm run seed` en el backend.</Footnote>

      <Field
        label="ID del rollo"
        value={tripId}
        onChangeText={setTripId}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="00000000-0000-4000-8000-000000000000"
      />
      <Field label="Token" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />

      {error && <ErrorText>{error}</ErrorText>}

      <Button label="Entrar" onPress={submit} disabled={!valid} loading={loading} />
    </Screen>
  );
}
