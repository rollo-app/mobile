import { Alert } from "react-native";
import { formatDateTime } from "@/features/trips/phase";
import { Row, Section } from "@/ui/components";
import { discardFailed } from "./discard";
import { failureText, nextAttemptText, pendingText } from "./upload-status";
import { useUploadStatus } from "./use-upload-status";

const FOOTER = "Se suben solas apenas hay conexión.";

/** Upload state for the active roll. Renders nothing when everything is uploaded. */
export function UploadStatusSection({ tripId, timeZone }: { tripId: string; timeZone: string }) {
  const status = useUploadStatus(tripId);
  if (!status.hasAnything) return null;

  const confirmDiscard = (id: string) =>
    Alert.alert("¿Descartar esta foto?", "Esta foto no se va a subir y se borra del celular. No se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => void discardFailed(tripId, id) },
    ]);

  const retry = nextAttemptText(status.nextRetryAt, Date.now());
  const hasPending = status.pending.length > 0;

  return (
    <>
      {hasPending && (
        <Section footer={retry ? `${FOOTER}\n${retry}` : FOOTER}>
          <Row label={pendingText(status.counts)} />
        </Section>
      )}
      {status.failed.length > 0 && (
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
      )}
    </>
  );
}
