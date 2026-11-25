import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { memberTotal } from "@/features/trips/member-total";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Loading } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { collageCandidates, collageCaption, pickCollage } from "./collage";
import { composeStill } from "./compose-still";
import { inviteLink, inviteMessage } from "./invite";
import { renderCollageCard } from "./render-collage";
import { shareKind, shareOptions, type ShareOption } from "./share-options";
import { ShareTargetButton } from "./share-target-button";
import { shareImageToWhatsApp, whatsAppAvailable, whatsAppUrl, writeShareFile } from "./share-story";

const LABEL: Record<ShareOption, string> = { link: "Copiar link", whatsapp: "WhatsApp", instagram: "Instagram" };

/** The "Compartir" sheet: copy the link, send it (or the collage) to WhatsApp, or open the Instagram Stories screen. */
export function ShareRollScreen({ tripId }: { tripId: string }) {
  const { detail } = useTripDetail(tripId);
  const { photos } = useRevealedPhotos(tripId);
  const [whatsapp, setWhatsapp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const kind = detail ? shareKind(detail, photos) : null;
  const candidates = useMemo(() => collageCandidates(photos), [photos]);

  useEffect(() => {
    let active = true;
    void whatsAppAvailable().then((available) => active && setWhatsapp(available));
    return () => {
      active = false;
    };
  }, []);

  if (!detail || !kind) {
    return (
      <View style={styles.sheet}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.label }]}>
          Compartir
        </Text>
        <Loading />
      </View>
    );
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  async function copyLink() {
    setFailed(false);
    try {
      await Clipboard.setStringAsync(inviteLink(detail!));
    } catch {
      setFailed(true);
      return;
    }
    Burnt.toast({ title: "Link copiado", preset: "done" });
    close();
  }

  async function sendToWhatsApp() {
    if (!detail || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (kind === "invite") {
        await Linking.openURL(whatsAppUrl(inviteMessage(detail)));
      } else {
        const { trip } = detail;
        const caption = collageCaption({ startsAt: trip.startsAt, endsAt: trip.endsAt, timeZone: trip.timezone, people: memberTotal(detail) });
        const card = await renderCollageCard({ name: trip.name, caption, photos: pickCollage(candidates, 0), style: "dark" });
        const uri = await writeShareFile(await composeStill(card, "dark"), "rollo-collage-dark-whatsapp-still.jpg");
        await shareImageToWhatsApp(uri);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const press: Record<ShareOption, () => void> = {
    link: () => void copyLink(),
    whatsapp: () => void sendToWhatsApp(),
    instagram: () => {
      close();
      router.push({ pathname: "/share-story", params: { tripId, kind } });
    },
  };

  return (
    <View style={styles.sheet}>
      <Text accessibilityRole="header" style={[type.title, { color: colors.label }]}>
        Compartir
      </Text>
      <View style={styles.row}>
        {shareOptions(kind, whatsapp).map((option) => (
          <ShareTargetButton key={option} option={option} label={LABEL[option]} busy={option === "whatsapp" && busy} onPress={press[option]} />
        ))}
      </View>
      {failed && <ErrorText>No se pudo compartir. Probá de nuevo.</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md, backgroundColor: colors.groupedBackground },
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.lg + spacing.xs, paddingTop: spacing.sm },
});
