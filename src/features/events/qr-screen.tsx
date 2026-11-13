import { File, Paths } from "expo-file-system";
import { useState } from "react";
import { Share, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading, Screen } from "@/ui/components";
import { colors, radius, spacing, type } from "@/ui/theme";
import { joinLinkUrl } from "./join-link";
import { QrCanvas, snapshotPng, useQrCanvasRef } from "./qr-canvas";

/** "Código QR": the event's name, its join link as a QR and the code under it, to show or share. */
export function QrScreen({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const { width } = useWindowDimensions();
  const canvasRef = useQrCanvasRef();
  const [failure, setFailure] = useState<string | null>(null);
  const size = Math.min(width - spacing.lg * 4, 320);

  const share = async () => {
    setFailure(null);
    try {
      const png = await snapshotPng(canvasRef);
      if (!png) throw new Error("no snapshot");
      const file = new File(Paths.cache, "rollo-qr.png");
      file.create({ overwrite: true });
      await file.write(png);
      await Share.share({ url: file.uri });
    } catch {
      setFailure("No se pudo compartir el código QR. Probá de nuevo.");
    }
  };

  return (
    <Screen grouped>
      {error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && <Loading />}
      {detail && (
        <>
          <View style={styles.card}>
            <Text style={[type.title, styles.name]} numberOfLines={2}>
              {detail.trip.name}
            </Text>
            <QrCanvas text={joinLinkUrl(detail.trip.joinCode)} size={size} canvasRef={canvasRef} />
            <Text selectable style={[type.largeTitle, styles.code]}>
              {detail.trip.joinCode}
            </Text>
          </View>
          <Button label="Compartir" onPress={() => void share()} />
        </>
      )}
      {failure && <ErrorText>{failure}</ErrorText>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.background },
  name: { color: colors.label, textAlign: "center" },
  code: { color: colors.label, letterSpacing: 4 },
});
