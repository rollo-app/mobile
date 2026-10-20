import { useState } from "react";
import { Alert } from "react-native";
import { queryClient } from "@/api/query-client";
import { formatDateTime } from "@/features/trips/phase";
import { Row, Section } from "@/ui/components";
import { discardFailed } from "./discard";
import { syncQueue } from "./sync";
import { failureText, nextAttemptText, pendingText } from "./upload-status";
import { queueKeys, useUploadStatus } from "./use-upload-status";

const FOOTER = "Se suben solas cuando hay conexión. No cierres la app desde el selector de apps.";

/** Upload state for the active roll. Renders nothing when everything is uploaded. */
export function UploadStatusSection({ tripId, timeZone }: { tripId: string; timeZone: string }) {
  const status = useUploadStatus(tripId);
  const [syncing, setSyncing] = useState(false);

  if (!status.hasAnything) return null;

  const uploadNow = async () => {
    setSyncing(true);
    try {
      await syncQueue();
    } finally {
      setSyncing(false);
      await Promise.all(queueKeys(tripId).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    }
  };

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
          <Row label="Subir ahora" onPress={syncing ? undefined : () => void uploadNow()} loading={syncing} />
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
            <Row key={`${m.id}-discard`} label="Descartar" tone="danger" onPress={() => confirmDiscard(m.id)} />,
          ])}
        </Section>
      )}
    </>
  );
}
