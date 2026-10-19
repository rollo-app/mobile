import { DatePicker, Form, Host, Picker, Section, Stepper, Text, TextField } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createTrip } from "@/features/trips/actions";
import { defaultStart, fitReveal, moveStart, validateRoll } from "@/features/trips/create-form";
import { ErrorText } from "@/ui/components";
import { colors, spacing } from "@/ui/theme";

const HOUR = 60 * 60 * 1000;
const DATE_TIME = ["date", "hourAndMinute"] as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type RevealMode = "end" | "custom";

export default function CreateScreen() {
  const initialStart = useMemo(() => defaultStart(Date.now()), []);
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState(initialStart + 72 * HOUR);
  const [revealMode, setRevealMode] = useState<RevealMode>("end");
  const [customReveal, setCustomReveal] = useState(initialStart + 84 * HOUR);
  const [photos, setPhotos] = useState(10);
  const [videos, setVideos] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealMoved, setRevealMoved] = useState(false);
  // Validation runs against this; refreshed on submit so a form left open doesn't keep a stale "now".
  const [now, setNow] = useState(() => Date.now());

  // With "Al terminar" the reveal follows the end on its own.
  const revealAt = revealMode === "end" ? endsAt : customReveal;
  const { valid, startError, endError, revealError } = validateRoll({ name, adminName, startsAt, endsAt, revealAt }, now);

  const dateError = startError ?? endError;

  function chooseReveal(mode: RevealMode) {
    if (mode === "custom") setCustomReveal(endsAt + 12 * HOUR);
    setRevealMoved(false);
    setRevealMode(mode);
  }

  function changeStart(date: Date) {
    const moved = moveStart({ startsAt, endsAt }, date.getTime());
    setStartsAt(moved.startsAt);
    changeEnd(moved.endsAt);
  }

  function changeEnd(end: number) {
    setEndsAt(end);
    const fit = fitReveal(customReveal, end);
    setCustomReveal(fit.revealAt);
    setRevealMoved(revealMode === "custom" && fit.moved);
  }

  async function submit() {
    const current = Date.now();
    setNow(current);
    if (!validateRoll({ name, adminName, startsAt, endsAt, revealAt }, current).valid) return;
    setError(null);
    setLoading(true);
    try {
      await createTrip({
        name,
        adminName,
        startsAt,
        endsAt,
        revealAt,
        dailyPhotoLimit: photos,
        dailyVideoLimit: videos,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.dismissTo("/roll");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el rollo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
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
            Crear
          </Stack.Toolbar.Button>
        )}
      </Stack.Toolbar>
      <Host style={styles.form}>
        <Form>
          <Section>
            <TextField placeholder="Nombre del rollo" maxLength={60} onTextChange={setName} />
            <TextField placeholder="Tu nombre" maxLength={30} onTextChange={setAdminName} />
          </Section>

          <Section title="Cuándo" footer={dateError ? <Text>{dateError}</Text> : undefined}>
            <DatePicker
              title="Empieza"
              selection={new Date(startsAt)}
              range={{ start: new Date(now) }}
              displayedComponents={[...DATE_TIME]}
              onDateChange={changeStart}
            />
            <DatePicker
              title="Termina"
              selection={new Date(endsAt)}
              range={{ start: new Date(startsAt + HOUR) }}
              displayedComponents={[...DATE_TIME]}
              onDateChange={(date) => changeEnd(date.getTime())}
            />
          </Section>

          <Section
            title="Revelado"
            footer={<Text>{revealError ?? (revealMoved ? "El revelado pasó al fin del rollo." : "Hasta el revelado nadie ve las fotos, ni las propias.")}</Text>}
          >
            <Picker
              selection={revealMode}
              onSelectionChange={chooseReveal}
              modifiers={[pickerStyle("segmented")]}
            >
              <Text modifiers={[tag("end")]}>Al terminar</Text>
              <Text modifiers={[tag("custom")]}>Otro momento</Text>
            </Picker>
            {revealMode === "custom" && (
              <DatePicker
                title="Se revela"
                selection={new Date(customReveal)}
                range={{ start: new Date(endsAt) }}
                displayedComponents={[...DATE_TIME]}
                onDateChange={(date) => {
                  setRevealMoved(false);
                  setCustomReveal(date.getTime());
                }}
              />
            )}
          </Section>

          <Section title="Por persona, por día" footer={<Text>Cada día se renueva a la medianoche.</Text>}>
            <Stepper label={count(photos, "foto", "fotos")} value={photos} min={1} max={100} onValueChange={setPhotos} />
            <Stepper label={count(videos, "video", "videos")} value={videos} min={0} max={20} onValueChange={setVideos} />
          </Section>
        </Form>
      </Host>

      {error && (
        <View style={styles.error}>
          <ErrorText>{error}</ErrorText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.groupedBackground },
  form: { flex: 1 },
  error: { padding: spacing.lg },
});
