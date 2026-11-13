import { Button, Form, Group, Host, Picker, RNHostView, Section, SwipeActions, Text, TextField, Toggle } from "@expo/ui/swift-ui";
import { accessibilityLabel, aspectRatio, foregroundStyle, listRowBackground, listRowInsets, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useMe } from "@/features/auth/use-me";
import { EventHero } from "@/features/events/event-hero";
import { pickCoverPhoto } from "@/features/events/use-upload-cover";
import { PRIVATE_ROLLO_NOTE } from "@/features/featured/featuring-section";
import { fetchFriends } from "@/features/friends/actions";
import { friendsKey } from "@/features/friends/use-friends";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { errorMessage } from "@/api/client";
import { uploadCover } from "@/features/trips/actions";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { tripKey } from "@/features/trips/use-trip-detail";
import {
  canCreate,
  canCreateEvent,
  cleanGroups,
  MAX_EVENT_GROUPS,
  MAX_GROUP_NAME,
  DEFAULT_MOMENT_WINDOW,
  defaultStart,
  effectiveStart,
  endAfter,
  revealNotBefore,
  type MomentMode,
  type StartMode,
} from "@/features/trips/create-form";
import { infoHeader, TripForm, type LimitMode, type RevealMode } from "@/features/trips/trip-form";
import { useCreateTrip } from "@/features/trips/use-create-trip";
import { colors } from "@/ui/theme";

const HOUR = 60 * 60 * 1000;

type Kind = "trip" | "event";
type GroupRow = { id: number; name: string };
type CoverPhoto = { uri: string; width: number; height: number };

export function CreateScreen() {
  const queryClient = useQueryClient();
  const initialStart = useMemo(() => defaultStart(Date.now()), []);
  const [name, setName] = useState("");
  const [startMode, setStartMode] = useState<StartMode>("now");
  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(initialStart + 72 * HOUR);
  const [revealMode, setRevealMode] = useState<RevealMode>("end");
  const [customReveal, setCustomReveal] = useState(initialStart + 84 * HOUR);
  const [photos, setPhotos] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [limitMode, setLimitMode] = useState<LimitMode>("daily");
  const [totalPhotos, setTotalPhotos] = useState(20);
  const [momentMode, setMomentMode] = useState<MomentMode>("photo_selfie");
  const [momentStart, setMomentStart] = useState(DEFAULT_MOMENT_WINDOW.start);
  const [momentEnd, setMomentEnd] = useState(DEFAULT_MOMENT_WINDOW.end);
  const [kind, setKind] = useState<Kind>("trip");
  // Rows have a stable id: the native text fields keep their own text, so removing one must not shift the others.
  const [groups, setGroups] = useState<GroupRow[]>([{ id: 0, name: "" }]);
  const nextGroupId = useRef(1);
  const [cover, setCover] = useState<CoverPhoto | null>(null);
  const create = useCreateTrip();
  // Events are enabled per account. Not blocking: until /me says so (or if it fails) this is the regular rollo form.
  const canPickEvent = useMe().me?.canCreateEvents === true;
  const isEvent = canPickEvent && kind === "event";
  const error = errorMessage(create.error, isEvent ? "No se pudo crear el evento" : "No se pudo crear el rollo");

  // With "Al terminar" the reveal follows the end on its own.
  const revealAt = revealMode === "end" ? endsAt : customReveal;
  const valid = isEvent
    ? canCreateEvent(
        name,
        groups.map((g) => g.name),
      )
    : canCreate(name);

  function chooseReveal(mode: RevealMode) {
    if (mode === "custom") setCustomReveal(endsAt + 12 * HOUR);
    setRevealMode(mode);
  }

  function chooseStart(mode: StartMode) {
    setStartMode(mode);
    // "Now" is at most the moment of submit; with a chosen date the end and the custom reveal must stay after it.
    const start = effectiveStart(mode, startsAt, Date.now());
    const end = endAfter(endsAt, start);
    if (end !== endsAt) {
      setEndsAt(end);
      setCustomReveal((reveal) => revealNotBefore(reveal, end));
    }
  }

  function chooseKind(next: Kind) {
    // The group fields are native and keep their own text: leaving them unmounts it, so start over on return.
    if (next === "trip") {
      setGroups([{ id: nextGroupId.current++, name: "" }]);
      setCover(null);
    }
    setKind(next);
  }

  function addGroup() {
    setGroups((rows) => [...rows, { id: nextGroupId.current++, name: "" }]);
  }

  async function chooseCover() {
    const photo = await pickCoverPhoto().catch(() => null);
    if (photo) setCover(photo);
  }

  // The event exists by now: the cover goes up in the background. If it fails the organizer sets it from the board.
  async function uploadChosenCover(tripId: string, photo: CoverPhoto) {
    try {
      await uploadCover(tripId, photo);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: tripKey(tripId) }),
        queryClient.invalidateQueries({ queryKey: myTripsKey }),
      ]);
    } catch {
      // Not blocking: it can be set later from the board.
    }
  }

  function submit() {
    if (isEvent) {
      create.mutate(
        {
          name,
          startsAt: effectiveStart(startMode, startsAt, Date.now()),
          endsAt,
          revealAt,
          photoLimit: { mode: "total", total: totalPhotos },
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          momentMode: "off",
          type: "event",
          groups: cleanGroups(groups.map((g) => g.name)),
          ...(isPrivate && { featuringDisabled: true }),
        },
        {
          onSuccess: (trip) => {
            if (cover) void uploadChosenCover(trip.id, cover);
            router.dismissTo("/roll");
            // An event has no friends to add: guests come in by code or QR.
            void offerPushAfterJoining();
          },
        },
      );
      return;
    }
    create.mutate(
      {
        name,
        startsAt: effectiveStart(startMode, startsAt, Date.now()),
        endsAt,
        revealAt,
        photoLimit: limitMode === "total" ? { mode: "total", total: totalPhotos } : { mode: "daily", perDay: photos },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        momentMode,
        momentWindowStart: momentStart,
        momentWindowEnd: momentEnd,
        ...(isPrivate && { featuringDisabled: true }),
      },
      {
        onSuccess: () => {
          router.dismissTo("/roll");
          void offerNext();
        },
      },
    );
  }

  // The roll exists and is active by now. Notifications are offered first (once), then, if you have
  // friends, adding them. Failing to load friends shows nothing: they can be added later from the board.
  async function offerNext() {
    let hasFriends = false;
    try {
      const friends = await queryClient.ensureQueryData({
        queryKey: friendsKey,
        queryFn: fetchFriends,
      });
      hasFriends = friends.length > 0;
    } catch {
      // Without friends loaded, the roll stays as is.
    }
    await offerPushAfterJoining(hasFriends ? "/add-friends" : undefined);
  }

  return (
    <View style={styles.screen}>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {create.isPending ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" disabled={!valid} onPress={submit}>
            Crear
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <Host style={styles.form}>
        <Form>
          {/* The server's message goes under the name, inside the form: above it, the transparent header covers it. */}
          {canPickEvent && (
            <Section>
              <Picker selection={kind} onSelectionChange={chooseKind} modifiers={[pickerStyle("segmented")]}>
                <Text modifiers={[tag("trip")]}>Rollo</Text>
                <Text modifiers={[tag("event")]}>Evento</Text>
              </Picker>
            </Section>
          )}

          <Section footer={error ? <Text modifiers={[foregroundStyle("red")]}>{error}</Text> : undefined}>
            <TextField placeholder={isEvent ? "Nombre del evento" : "Nombre del rollo"} maxLength={60} onTextChange={setName} />
          </Section>

          {isEvent && (
            <Section header={<Text>Grupos</Text>} footer={<Text>Los invitados eligen en cuál están. Deslizá un grupo para borrarlo.</Text>}>
              {groups.map((group) => (
                <SwipeActions key={group.id}>
                  <TextField
                    placeholder="Nombre del grupo"
                    maxLength={MAX_GROUP_NAME}
                    onTextChange={(text) => setGroups((rows) => rows.map((r) => (r.id === group.id ? { ...r, name: text } : r)))}
                  />
                  <SwipeActions.Actions>
                    <Button role="destructive" label="Borrar" onPress={() => setGroups((rows) => rows.filter((r) => r.id !== group.id))} />
                  </SwipeActions.Actions>
                </SwipeActions>
              ))}
              {groups.length < MAX_EVENT_GROUPS && <Button label="Agregar grupo" systemImage="plus" onPress={addGroup} />}
            </Section>
          )}

          {isEvent && (
            <Section header={<Text>Portada</Text>} footer={<Text>Opcional. La podés cambiar después desde el tablero.</Text>}>
              {cover && (
                // The same hero the board and the join screen show, edge to edge in its row: what guests will see.
                // SwiftUI makes the row square (the width comes from the form); the hero fills it. Sizing it from the RN
                // side left a thin strip: the hosted view was measured before it knew its width.
                <Group
                  modifiers={[
                    listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
                    listRowBackground("transparent"),
                    aspectRatio({ ratio: 1, contentMode: "fit" }),
                  ]}
                >
                  <RNHostView>
                    <EventHero name={name.trim() || "Nombre del evento"} coverUrl={cover.uri} />
                  </RNHostView>
                </Group>
              )}
              <Button label={cover ? "Cambiar portada" : "Elegir portada"} onPress={() => void chooseCover()} />
              {cover && <Button role="destructive" label="Quitar portada" onPress={() => setCover(null)} />}
            </Section>
          )}

          <TripForm
            values={{
              startMode,
              startsAt,
              endsAt,
              revealMode,
              customReveal,
              limitMode: isEvent ? "total" : limitMode,
              photos,
              totalPhotos,
              momentMode,
              momentStart,
              momentEnd,
            }}
            on={{
              onStartModeChange: chooseStart,
              onStartsAtChange: setStartsAt,
              onEndsAtChange: setEndsAt,
              onRevealModeChange: chooseReveal,
              onCustomRevealChange: setCustomReveal,
              onLimitModeChange: setLimitMode,
              onPhotosChange: setPhotos,
              onTotalPhotosChange: setTotalPhotos,
              onMomentModeChange: setMomentMode,
              onMomentStartChange: setMomentStart,
              onMomentEndChange: setMomentEnd,
            }}
            locks={isEvent ? { limitMode: true } : undefined}
            hideMoment={isEvent}
          />

          <Section header={infoHeader("Privacidad", "privateRollo")} footer={<Text>{PRIVATE_ROLLO_NOTE}</Text>}>
            <Toggle label="Rollo privado" isOn={isPrivate} onIsOnChange={setIsPrivate} modifiers={[accessibilityLabel("Rollo privado")]} />
          </Section>
        </Form>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.groupedBackground },
  form: { flex: 1 },
});
