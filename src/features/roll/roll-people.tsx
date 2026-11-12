import { router } from "expo-router";
import { useState } from "react";
import { Alert, Share } from "react-native";
import { errorMessage } from "@/api/client";
import { InfoButton } from "@/features/info/info-button";
import { FeaturingSection } from "@/features/featured/featuring-section";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import type { TripDetail } from "@/features/trips/actions";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { editableFields } from "@/features/trips/edit-form";
import { useArchiveTrip } from "@/features/trips/use-archive-trip";
import { canRename } from "@/features/trips/roles";
import { ErrorText, Row, Section } from "@/ui/components";
import { useDeleteTrip } from "./use-delete-trip";
import { MemberRow } from "./member-row";
import { previewMembers } from "./members-order";
import { useMemberActions } from "./use-member-actions";
import { MAX_TRIP_NAME, nextTripName, useRenameTrip } from "./use-rename-trip";

/**
 * The invite (code and share) and the members of a roll. Tapping a member (not you) opens their profile.
 */
export function RollPeople({ detail }: { detail: TripDetail }) {
  const share = () =>
    Share.share({ message: `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}` });

  const leave = useLeaveTrip(detail.trip.id, detail.trip.name, { revealed: detail.trip.revealed });
  const deleteTrip = useDeleteTrip(detail.trip.id, detail.trip.name);
  const { setArchived } = useArchiveTrip();
  const archived = useActiveTrip().trips.find((t) => t.id === detail.trip.id)?.archived ?? false;
  const rename = useRenameTrip(detail.trip.id);
  const [nameTooLong, setNameTooLong] = useState(false);
  const members = useMemberActions(detail.trip.id, [rename]);
  // Only the latest action's error shows: starting a rename clears the member actions' errors.
  const startRename = () => {
    members.start(rename);
    setNameTooLong(false);
  };
  const preview = previewMembers(detail.members, detail.me.id);

  const editName = () =>
    Alert.prompt(
      "Nombre del rollo",
      undefined,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Guardar",
          onPress: (text?: string) => {
            const name = nextTripName(text ?? "", detail.trip.name);
            if (name) {
              startRename();
              rename.mutate(name);
            } else if ((text ?? "").trim().length > MAX_TRIP_NAME) {
              startRename();
              setNameTooLong(true);
            }
          },
        },
      ],
      "plain-text",
      detail.trip.name,
    );
  const failure =
    (nameTooLong ? `El nombre puede tener hasta ${MAX_TRIP_NAME} caracteres` : null) ??
    members.failure ??
    errorMessage(rename.error, "No se pudo cambiar el nombre");

  return (
    <>
      {canRename(detail.me) && (
        <Section>
          <Row label="Nombre" value={detail.trip.name} onPress={editName} />
          {editableFields(detail.trip, Date.now()).end && (
            <Row label="Editar rollo" onPress={() => router.push({ pathname: "/edit-trip", params: { tripId: detail.trip.id } })} />
          )}
        </Section>
      )}

      {!detail.trip.revealed && (
        <Section>
          <Row label="Sumar amigos" onPress={() => router.push("/add-friends")} />
        </Section>
      )}

      <Section title="Invitar" titleAccessory={<InfoButton topic="inviteCode" />} footer="Con este código se suman al rollo.">
        <Row label="Código" value={detail.trip.joinCode} />
        <Row label="Compartir invitación" chevron={false} onPress={() => void share()} />
      </Section>

      <FeaturingSection detail={detail} />

      <Section title={`En el rollo · ${detail.members.length}`}>
        {preview.shown.map((m) => (
          <MemberRow key={m.id} me={detail.me} member={m} onAction={members.run} />
        ))}
        {preview.hasMore && (
          <Row
            label="Ver todos"
            value={String(preview.total)}
            onPress={() => router.push({ pathname: "/roll-members", params: { tripId: detail.trip.id } })}
          />
        )}
      </Section>
      {failure && <ErrorText>{failure}</ErrorText>}

      {detail.trip.revealed && (
        <Section>
          <Row
            label={archived ? "Desarchivar rollo" : "Archivar rollo"}
            chevron={false}
            onPress={() => setArchived(detail.trip.id, !archived)}
          />
        </Section>
      )}

      {!detail.me.isCreator && (
        <Section>
          <Row label="Salirme del rollo" tone="danger" chevron={false} loading={leave.leaving} onPress={leave.leaving ? undefined : leave.confirm} />
        </Section>
      )}
      {leave.error && <ErrorText>{leave.error}</ErrorText>}

      {detail.me.isCreator && (
        <Section>
          <Row label="Borrar rollo" tone="danger" chevron={false} loading={deleteTrip.deleting} onPress={deleteTrip.deleting ? undefined : deleteTrip.confirm} />
        </Section>
      )}
      {deleteTrip.error && <ErrorText>{deleteTrip.error}</ErrorText>}
    </>
  );
}
