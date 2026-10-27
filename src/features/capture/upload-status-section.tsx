import type { ReactNode } from "react";
import { Alert, StyleSheet } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { formatDateTime } from "@/features/trips/phase";
import { Row, Section } from "@/ui/components";
import { spacing } from "@/ui/theme";
import { useReduceMotion } from "@/ui/use-reduce-motion";
import { discardFailed } from "./discard";
import { failureText, nextAttemptText, pendingText } from "./upload-status";
import { useUploadStatus } from "./use-upload-status";

const FOOTER = "Se suben solas apenas hay conexión.";

// Built at render, never at module scope (Reanimated is mocked as an empty object in some Jest suites).
const makeLayout = () => LinearTransition.duration(250).easing(Easing.bezier(0.23, 1, 0.32, 1));

/** Position transition for a block next to the upload sections; with Reduce Motion (or still unknown) it just jumps. */
function useBlockLayout() {
  const reduceMotion = useReduceMotion();
  return reduceMotion === false ? makeLayout() : undefined;
}

/** Wraps the blocks below the upload sections so they glide when those appear or disappear instead of jumping. */
export function BelowUploads({ children }: { children: ReactNode }) {
  const layout = useBlockLayout();
  return (
    <Animated.View layout={layout} style={styles.below}>
      {children}
    </Animated.View>
  );
}

/** Upload state for the active roll. Renders nothing when everything is uploaded. */
export function UploadStatusSection({ tripId, timeZone }: { tripId: string; timeZone: string }) {
  const status = useUploadStatus(tripId);
  const layout = useBlockLayout();
  if (!status.hasAnything) return null;

  const confirmDiscard = (id: string) =>
    Alert.alert("¿Descartar esta foto?", "Esta foto no se va a subir y se borra del celular. No se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => void discardFailed(tripId, id) },
    ]);

  const retry = nextAttemptText(status.nextRetryAt, Date.now());
  const hasPending = status.pending.length > 0;
  const fade = { entering: FadeIn.duration(200), exiting: FadeOut.duration(150), layout };

  return (
    <>
      {hasPending && (
        <Animated.View key="pending" {...fade}>
          <Section footer={retry ? `${FOOTER}\n${retry}` : FOOTER}>
            <Row label={pendingText(status.counts)} />
          </Section>
        </Animated.View>
      )}
      {status.failed.length > 0 && (
        <Animated.View key="failed" {...fade}>
          <Section title="No se pudieron subir">
            {status.failed.flatMap((m) => [
              <Row
                key={m.id}
                label={`${m.type === "video" ? "Video" : "Foto"} · ${formatDateTime(m.takenAt, Date.now(), timeZone)}`}
                value={failureText(m.failedReason)}
              />,
              <Row key={`${m.id}-discard`} label="Descartar" tone="danger" chevron={false} onPress={() => confirmDiscard(m.id)} />,
            ])}
          </Section>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({ below: { gap: spacing.lg } });
