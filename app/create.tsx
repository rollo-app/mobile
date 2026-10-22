import { DatePicker, Form, Host, Picker, Section, Stepper, Text, TextField } from "@expo/ui/swift-ui";
import { foregroundStyle, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { fetchFriends } from "@/features/friends/actions";
import { friendsKey } from "@/features/friends/use-friends";
import { requestRevealPermission } from "@/features/notifications/reveal";
import { createTrip } from "@/features/trips/actions";
import { canCreate, defaultStart } from "@/features/trips/create-form";
import { myTripsKey } from "@/features/trips/use-active-trip";
import { colors } from "@/ui/theme";

const HOUR = 60 * 60 * 1000;
const DATE_TIME = ["date", "hourAndMinute"] as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type RevealMode = "end" | "custom";

export default function CreateScreen() {
  const queryClient = useQueryClient();
  const initialStart = useMemo(() => defaultStart(Date.now()), []);
  const [name, setName] = useState("");
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
  const valid = canCreate(name);

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
        startsAt,
        endsAt,
        revealAt,
        dailyPhotoLimit: photos,
        dailyVideoLimit: videos,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await queryClient.invalidateQueries({ queryKey: myTripsKey });
      router.dismissTo("/roll");
      void requestRevealPermission();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el rollo");
      return;
    } finally {
      setLoading(false);
    }
    await offerFriends();
  }

  // The roll exists and is active by now: if you have friends, offer to add them. Failing here shows nothing.
  async function offerFriends() {
    try {
      const friends = await queryClient.ensureQueryData({ queryKey: friendsKey, queryFn: fetchFriends });
      if (friends.length > 0) router.push("/add-friends");
    } catch {
      // Without friends loaded, the roll stays as is; they can be added later from the board.
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
          {/* The server's message goes under the name, inside the form: above it, the transparent header covers it. */}
          <Section footer={error ? <Text modifiers={[foregroundStyle("red")]}>{error}</Text> : undefined}>
            <TextField placeholder="Nombre del rollo" maxLength={60} onTextChange={setName} />
          </Section>

          <Section title="Cuándo">
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

          <Section title="Revelado" footer={<Text>Hasta el revelado nadie ve las fotos, ni las propias.</Text>}>
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
                displayedComponents={[...DATE_TIME]}
                onDateChange={(date) => setCustomReveal(date.getTime())}
              />
            )}
          </Section>

          <Section title="Por persona, por día" footer={<Text>Cada día se renueva a la medianoche.</Text>}>
            <Stepper label={count(photos, "foto", "fotos")} value={photos} min={1} max={100} onValueChange={setPhotos} />
            <Stepper label={count(videos, "video", "videos")} value={videos} min={0} max={20} onValueChange={setVideos} />
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
