import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ApiError, errorMessage } from "@/api/client";
import { EventHero } from "@/features/events/event-hero";
import { PickGroups } from "@/features/events/pick-groups";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { ErrorText, Field, Footnote, Screen } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { usePreviewEvent } from "@/features/events/use-preview-event";
import type { EventPreview } from "./actions";
import { useJoinTrip } from "./use-join-trip";

const REVEALED_EVENT = "Este evento ya se reveló.";
const EVENT_NEEDS_UPDATE = "EVENT_NEEDS_UPDATE";

export function JoinScreen({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 6));
  const [event, setEvent] = useState<EventPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const preview = usePreviewEvent();
  const join = useJoinTrip();
  const error = errorMessage(join.error, "No se pudo entrar al rollo");

  // A code that arrives from a link (or changes in the route) is looked up by itself, so the guest lands on the groups.
  const lookedUp = useRef<string | null>(null);
  const linkCode = initialCode.toUpperCase().slice(0, 6);
  useEffect(() => {
    if (lookedUp.current === linkCode) return;
    lookedUp.current = linkCode;
    setCode(linkCode);
    setEvent(null);
    setSelected([]);
    join.reset();
    if (linkCode.length !== 6) return;
    // A regular rollo (or a failed lookup) just leaves the code filled in: joining it is up to the guest.
    preview.mutate(linkCode, { onSuccess: (found) => found && setEvent(found) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  const valid = code.trim().length === 6;
  const busy = preview.isPending || join.isPending;

  function onSuccess() {
    router.dismissTo("/roll");
    void offerPushAfterJoining();
  }

  function submit() {
    // A lookup that fails (no signal, server error) never blocks a regular rollo: joining answers for itself.
    const joinDirectly = () =>
      join.mutate(
        { code },
        {
          onSuccess,
          onError: (e) => {
            // The lookup failed and the server says it's an event: look it up once more to show its groups
            // (if that fails too, the server's message stays).
            if (!(e instanceof ApiError && e.code === EVENT_NEEDS_UPDATE)) return;
            preview.mutate(code, {
              onSuccess: (found) => {
                if (!found) return;
                join.reset();
                setEvent(found);
                setSelected([]);
              },
            });
          },
        },
      );
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
        <Stack.Toolbar.Button onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>Cancelar</Stack.Toolbar.Button>
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
          {event.coverUrl ? (
            <EventHero name={event.name} coverUrl={event.coverUrl} eyebrow="Te invitaron a" />
          ) : (
            <Text accessibilityRole="header" style={styles.name}>
              {event.name}
            </Text>
          )}
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
  name: { ...type.title, color: colors.label, paddingHorizontal: spacing.md },
  groups: { gap: spacing.sm },
});
