import { DatePicker, Form, Host, Picker, Section, Stepper, Text, TextField } from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { createTrip } from "@/features/trips/actions";
import { defaultStart, validateRoll } from "@/features/trips/create-form";
import { Button, ErrorText } from "@/ui/components";
import { colors, spacing } from "@/ui/theme";

const HOUR = 60 * 60 * 1000;
const DATE_TIME = ["date", "hourAndMinute"] as const;

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

  // With "Al terminar" the reveal follows the end on its own.
  const revealAt = revealMode === "end" ? endsAt : customReveal;
  const { valid, endError, revealError } = validateRoll({ name, adminName, startsAt, endsAt, revealAt });

  function chooseReveal(mode: RevealMode) {
    if (mode === "custom") setCustomReveal(endsAt + 12 * HOUR);
    setRevealMode(mode);
  }

  async function submit() {
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
      <Host style={styles.form}>
        <Form>
          <Section>
            <TextField placeholder="Sur 2027" maxLength={60} onTextChange={setName} />
            <TextField placeholder="Como te conocen" maxLength={30} onTextChange={setAdminName} />
          </Section>

          <Section title="Cuándo" footer={endError ? <Text>{endError}</Text> : undefined}>
            <DatePicker
              title="Empieza"
              selection={new Date(startsAt)}
              displayedComponents={[...DATE_TIME]}
              onDateChange={(date) => setStartsAt(date.getTime())}
            />
            <DatePicker
              title="Termina"
              selection={new Date(endsAt)}
              displayedComponents={[...DATE_TIME]}
              onDateChange={(date) => setEndsAt(date.getTime())}
            />
          </Section>

          <Section
            title="Revelado"
            footer={<Text>{revealError ?? "Hasta el revelado nadie ve las fotos, ni las propias."}</Text>}
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
                onDateChange={(date) => setCustomReveal(date.getTime())}
              />
            )}
          </Section>

          <Section title="Por persona, por día" footer={<Text>Cada día se renueva a la medianoche.</Text>}>
            <Stepper label="Fotos" value={photos} min={1} max={100} onValueChange={setPhotos} />
            <Stepper label="Videos" value={videos} min={0} max={20} onValueChange={setVideos} />
          </Section>
        </Form>
      </Host>

      <View style={styles.actions}>
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Crear rollo" onPress={submit} disabled={!valid} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.groupedBackground },
  form: { flex: 1 },
  actions: { gap: spacing.md, padding: spacing.lg },
});
