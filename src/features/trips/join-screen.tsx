import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ApiError, errorMessage } from "@/api/client";
import { EventDescription } from "@/features/events/event-description";
import { EventHero } from "@/features/events/event-hero";
import { joinedLine, previewDates, revealedMessage } from "@/features/events/event";
import { PickGroups } from "@/features/events/pick-groups";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { ErrorText, Field, Footnote, Screen } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { usePreviewEvent } from "@/features/events/use-preview-event";
import type { EventPreview } from "./actions";
import { rollHref } from "./roll-href";
import { useActiveTrip } from "./use-active-trip";
import { useJoinTrip } from "./use-join-trip";

const EVENT_NEEDS_UPDATE = "EVENT_NEEDS_UPDATE";

export function JoinScreen({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 6));
  const [event, setEvent] = useState<EventPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const preview = usePreviewEvent();
  const { trips } = useActiveTrip();
  const join = useJoinTrip();
  const dates = event ? previewDates(event) : "";
  const joined = event ? joinedLine(event.memberCount) : null;
  const error = errorMessage(join.error, "No se pudo entrar al rollo");

  // A code that arrives from a link (or changes in the route) is looked up by itself, so the guest lands on the groups.
  const lookedUp = useRef<string | null>(null);
  const linkCode = initialCode.toUpperCase().slice(0, 6);
  // Opens the rollo behind the link when you're already in it (at most once per link).
  const opened = useRef(false);
  function openMine(): boolean {
    if (opened.current || linkCode.length !== 6) return false;
    const mine = trips.find((t) => t.joinCode.toUpperCase() === linkCode);
    if (!mine) return false;
    opened.current = true;
    router.dismissTo("/roll");
    router.push(rollHref(mine.id));
    return true;
  }
  useEffect(() => {
    if (lookedUp.current === linkCode) return;
    lookedUp.current = linkCode;
    opened.current = false;
    setCode(linkCode);
    setEvent(null);
    setSelected([]);
    join.reset();
    if (linkCode.length !== 6) return;
    // A link to a rollo you're already in just opens it: no preview, no join.
    if (openMine()) return;
    // A failed lookup just leaves the code filled in: joining it is up to the guest.
    preview.mutate(linkCode, { onSuccess: (found) => found && setEvent(found) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode]);

  // The persisted list can arrive after the screen (cold start from a QR): re-check while the link's preview is showing.
  useEffect(() => {
    if (lookedUp.current === linkCode) openMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trips]);

  const valid = code.trim().length === 6;
  const busy = preview.isPending || join.isPending;

  function onSuccess(joined: { id: string }) {
    router.dismissTo("/roll");
    router.push(rollHref(joined.id));
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
        // A regular rollo has no groups to pick: a typed code joins it right away.
        if (!found || found.type === "trip") return joinDirectly();
        setEvent(found);
        setSelected([]);
      },
      onError: joinDirectly,
    });
  }

  function enter() {
    // A regular rollo has no groups: the server rejects an empty `groupIds`, so the key is left out.
    join.mutate(event?.type === "trip" ? { code } : { code, groupIds: selected }, { onSuccess });
  }

  const choosing = event !== null;
  const isTrip = event?.type === "trip";
  const action = choosing ? (!event.revealed && (isTrip || selected.length > 0) ? enter : undefined) : valid ? submit : undefined;
  // A revealed regular rollo can't be joined: no button at all.
  const showAction = !(isTrip && event.revealed);

  return (
    <Screen grouped>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {!showAction ? null : busy ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" disabled={!action} onPress={() => action?.()}>
            {choosing && !isTrip ? "Entrar" : "Unirme"}
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>

      {event ? (
        <>
          {event.coverUrl ? (
            <EventHero
              name={event.name}
              coverUrl={event.coverUrl}
              eyebrow="Te invitaron a"
              caption={isTrip ? dates : undefined}
              description={event.description}
            />
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.name}>
                {event.name}
              </Text>
              {isTrip && <Text style={styles.joined}>{dates}</Text>}
              {!!event.description && (
                <View style={styles.description}>
                  <EventDescription text={event.description} />
                </View>
              )}
            </>
          )}
          {event.revealed ? (
            <ErrorText>{revealedMessage(event)}</ErrorText>
          ) : isTrip ? (
            joined !== null && <Text style={styles.joined}>{joined}</Text>
          ) : (
            <View style={styles.groups}>
              {joined !== null && <Text style={styles.joined}>{joined}</Text>}
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

      {!!error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  description: { paddingHorizontal: spacing.md },
  name: { ...type.title, color: colors.label, paddingHorizontal: spacing.md },
  groups: { gap: spacing.sm },
  joined: { ...type.subhead, color: colors.secondaryLabel, fontVariant: ["tabular-nums"], paddingHorizontal: spacing.md },
});
