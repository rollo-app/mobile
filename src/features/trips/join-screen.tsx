import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "@/api/client";
import { API_URL } from "@/config";
import { PickGroups } from "@/features/events/pick-groups";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { ErrorText, Field, Footnote, Screen } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { usePreviewEvent } from "@/features/events/use-preview-event";
import type { EventPreview } from "./actions";
import { useJoinTrip } from "./use-join-trip";

const REVEALED_EVENT = "Este evento ya se reveló.";

export function JoinScreen({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 6));
  const [event, setEvent] = useState<EventPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const preview = usePreviewEvent();
  const join = useJoinTrip();
  const error = errorMessage(join.error, "No se pudo entrar al rollo");

  const valid = code.trim().length === 6;
  const busy = preview.isPending || join.isPending;

  function onSuccess() {
    router.dismissTo("/roll");
    void offerPushAfterJoining();
  }

  function submit() {
    // A lookup that fails (no signal, server error) never blocks a regular rollo: joining answers for itself.
    const joinDirectly = () => join.mutate({ code }, { onSuccess });
    preview.mutate(code, {
      onSuccess: (found) => {
        if (!found) return joinDirectly();
        setEvent(found);
        setSelected([]);
      },
      onError: joinDirectly,
    });
  }

  function enter() {
    join.mutate({ code, groupIds: selected }, { onSuccess });
  }

  const choosing = event !== null;
  const action = choosing ? (!event.revealed && selected.length > 0 ? enter : undefined) : valid ? submit : undefined;

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {busy ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" disabled={!action} onPress={() => action?.()}>
            {choosing ? "Entrar" : "Unirme"}
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      {event ? (
        <>
          {event.coverUrl && <Image source={{ uri: `${API_URL}${event.coverUrl}` }} style={styles.cover} contentFit="cover" accessibilityIgnoresInvertColors />}
          <Text accessibilityRole="header" style={styles.name}>
            {event.name}
          </Text>
          {event.revealed ? (
            <ErrorText>{REVEALED_EVENT}</ErrorText>
          ) : (
            <View style={styles.groups}>
              <Footnote>{event.groups.length > 1 ? "Elegí tus grupos" : "Elegí tu grupo"}</Footnote>
              <PickGroups groups={event.groups} selected={selected} onChange={setSelected} />
            </View>
          )}
        </>
      ) : (
        <>
          <Footnote>Pedile el código a quien creó el rollo.</Footnote>
          <Field
            label="Código del rollo"
            value={code}
            onChangeText={(value) => {
              setCode(value.toUpperCase());
              join.reset();
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            placeholder="Ingresar código"
          />
        </>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 160, borderRadius: radius.lg, backgroundColor: colors.fill },
  name: { ...type.title, color: colors.label, paddingHorizontal: spacing.md },
  groups: { gap: spacing.sm },
});
