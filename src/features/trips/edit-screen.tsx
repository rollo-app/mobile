import { Form, Host, Text } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { errorMessage } from "@/api/client";
import type { TripDetail } from "@/features/trips/actions";
import { canSave, changedFields, editableFields, lockedNote, revealFollowsEnd, settingsOf, type TripSettings } from "@/features/trips/edit-form";
import { TripForm, type LimitMode, type RevealMode } from "@/features/trips/trip-form";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { useUpdateTrip } from "@/features/trips/use-update-trip";
import { Loading } from "@/ui/components";
import { colors } from "@/ui/theme";

const DEFAULT_TOTAL_PHOTOS = 20;

/** Edit dates, quota and daily moment of a rollo (admins). Same form as Create, with what the stage locks disabled. */
export function EditTripScreen({ tripId }: { tripId: string }) {
  const { detail } = useTripDetail(tripId);
  if (!detail) return <Loading />;
  return <EditTripForm tripId={tripId} trip={detail.trip} />;
}

function EditTripForm({ tripId, trip }: { tripId: string; trip: TripDetail["trip"] }) {
  // The values at the time the screen opened: edits are compared against these, even if the detail refetches meanwhile.
  const before = useMemo(() => settingsOf(trip), []); // eslint-disable-line react-hooks/exhaustive-deps
  const editable = useMemo(() => editableFields(trip, Date.now()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [startsAt, setStartsAt] = useState(before.startsAt);
  const [endsAt, setEndsAt] = useState(before.endsAt);
  const [revealMode, setRevealMode] = useState<RevealMode>(revealFollowsEnd(before) ? "end" : "custom");
  const [customReveal, setCustomReveal] = useState(before.revealAt);
  const [limitMode, setLimitMode] = useState<LimitMode>(before.photoLimitMode);
  const [photos, setPhotos] = useState(before.dailyPhotoLimit);
  const [totalPhotos, setTotalPhotos] = useState(before.totalPhotoLimit ?? DEFAULT_TOTAL_PHOTOS);
  const [momentMode, setMomentMode] = useState(before.momentMode);
  const [momentStart, setMomentStart] = useState(before.momentWindowStart);
  const [momentEnd, setMomentEnd] = useState(before.momentWindowEnd);
  const update = useUpdateTrip(tripId);
  const error = errorMessage(update.error, "No se pudo guardar el rollo");

  const after: TripSettings = {
    startsAt,
    endsAt,
    revealAt: revealMode === "end" ? endsAt : customReveal,
    photoLimitMode: limitMode,
    dailyPhotoLimit: photos,
    totalPhotoLimit: limitMode === "total" ? totalPhotos : before.totalPhotoLimit,
    momentMode,
    momentWindowStart: momentStart,
    momentWindowEnd: momentEnd,
  };
  const changes = changedFields(before, after, revealMode);

  function chooseReveal(mode: RevealMode) {
    if (mode === "custom") setCustomReveal(Math.max(endsAt, before.revealAt));
    setRevealMode(mode);
  }

  return (
    <View style={styles.screen}>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>Cancelar</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {update.isPending ? (
          <Stack.Toolbar.View>
            <ActivityIndicator />
          </Stack.Toolbar.View>
        ) : (
          <Stack.Toolbar.Button variant="done" disabled={!canSave(changes)} onPress={() => update.mutate(changes, { onSuccess: () => router.back() })}>
            Guardar
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <Host style={styles.form}>
        <Form>
          <TripForm
            values={{ startsAt, endsAt, revealMode, customReveal, limitMode, photos, totalPhotos, momentMode, momentStart, momentEnd }}
            on={{
              onStartModeChange: () => {},
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
            locks={{
              start: !editable.start,
              end: !editable.end,
              reveal: !editable.reveal,
              limitMode: !editable.limitMode,
              limit: !editable.limit,
              moment: !editable.moment,
            }}
            notes={{ start: lockedNote("start"), limitMode: lockedNote("limitMode") }}
            whenFooter={error ? <Text modifiers={[foregroundStyle("red")]}>{error}</Text> : undefined}
          />
        </Form>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.groupedBackground },
  form: { flex: 1 },
});
