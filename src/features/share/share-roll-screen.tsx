import * as Burnt from "burnt";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import { useRevealedPhotos } from "@/features/media/revealed";
import { memberTotal } from "@/features/trips/member-total";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { ErrorText, Row, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { collageCandidates, collageCaption, pickCollage } from "./collage";
import { composeStill } from "./compose-still";
import { inviteLink, inviteMessage } from "./invite";
import { renderCollageCard } from "./render-collage";
import { shareKind, shareOptions, type ShareOption } from "./share-options";
import { shareImageToWhatsApp, whatsAppAvailable, whatsAppUrl, writeShareFile } from "./share-story";

const LABEL: Record<ShareOption, string> = { link: "Copiar link", whatsapp: "WhatsApp", instagram: "Instagram" };
const LOGO = 28;

function OptionIcon({ option }: { option: ShareOption }) {
  if (option === "link") {
    return (
      <View style={styles.icon}>
        <SymbolView name="link" size={22} tintColor={colors.tint} />
      </View>
    );
  }
  const source = option === "whatsapp" ? require("../../../assets/share/whatsapp.png") : require("../../../assets/share/instagram.png");
  return <Image source={source} style={styles.icon} accessible={false} />;
}

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

  if (!detail || !kind) return null;

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  async function copyLink() {
    await Clipboard.setStringAsync(inviteLink(detail!));
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
      <Section>
        {shareOptions(kind, whatsapp).map((option) => (
          <Row
            key={option}
            label={LABEL[option]}
            leading={<OptionIcon option={option} />}
            chevron={false}
            loading={option === "whatsapp" && busy}
            disabled={option === "whatsapp" && busy}
            onPress={press[option]}
          />
        ))}
      </Section>
      {failed && <ErrorText>No se pudo compartir. Probá de nuevo.</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md, backgroundColor: colors.groupedBackground },
  icon: { width: LOGO, height: LOGO, alignItems: "center", justifyContent: "center" },
});
