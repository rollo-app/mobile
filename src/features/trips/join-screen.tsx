import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { errorMessage } from "@/api/client";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { ErrorText, Field, Footnote, Screen } from "@/ui/components";
import { useJoinTrip } from "./use-join-trip";

export function JoinScreen() {
  const [code, setCode] = useState("");
  const join = useJoinTrip();
  const error = errorMessage(join.error, "No se pudo entrar al rollo");

  const valid = code.trim().length === 6;

  function submit() {
    join.mutate(
      { code },
      {
        onSuccess: () => {
          router.dismissTo("/roll");
          void offerPushAfterJoining();
        },
      },
    );
  }

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {join.isPending ? (
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
