import { Form, Host, Section, Text, TextField, Toggle } from "@expo/ui/swift-ui";
import { accessibilityLabel, foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { PRIVATE_ROLLO_NOTE } from "@/features/featured/featuring-section";
import { fetchFriends } from "@/features/friends/actions";
import { friendsKey } from "@/features/friends/use-friends";
import { offerPushAfterJoining } from "@/features/notifications/offer-push";
import { errorMessage } from "@/api/client";
import {
  canCreate,
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
  const create = useCreateTrip();
  const error = errorMessage(create.error, "No se pudo crear el rollo");

  // With "Al terminar" the reveal follows the end on its own.
  const revealAt = revealMode === "end" ? endsAt : customReveal;
  const valid = canCreate(name);

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

  function submit() {
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
      const friends = await queryClient.ensureQueryData({ queryKey: friendsKey, queryFn: fetchFriends });
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
          <Section footer={error ? <Text modifiers={[foregroundStyle("red")]}>{error}</Text> : undefined}>
            <TextField placeholder="Nombre del rollo" maxLength={60} onTextChange={setName} />
          </Section>

          <TripForm
            values={{ startMode, startsAt, endsAt, revealMode, customReveal, limitMode, photos, totalPhotos, momentMode, momentStart, momentEnd }}
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
