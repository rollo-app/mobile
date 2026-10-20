import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { requestRevealPermission } from "@/features/notifications/reveal";
import { joinTrip } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { ErrorText, Field, Footnote, Screen } from "@/ui/components";

export default function JoinScreen() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = code.trim().length === 6;

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      await joinTrip({ code });
      await queryClient.invalidateQueries({ queryKey: myTripsKey });
      router.dismissTo("/roll");
      void requestRevealPermission();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar al rollo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {loading ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" disabled={!valid} onPress={submit}>
            Unirme
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <Footnote>Pedile el código a quien creó el rollo.</Footnote>

      <Field
        label="Código del rollo"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="HUB5FT"
      />

      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}
