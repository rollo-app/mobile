import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { errorMessage } from "@/api/client";
import { EventCover } from "@/features/events/event-cover";
import { EventGroupsSection } from "@/features/events/event-groups-section";
import { isEvent } from "@/features/events/event";
import { FeaturingSection } from "@/features/featured/featuring-section";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import type { TripDetail } from "@/features/trips/actions";
import { editableFields } from "@/features/trips/edit-form";
import { canRename } from "@/features/trips/roles";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { useArchiveTrip } from "@/features/trips/use-archive-trip";
import { useRollPhase } from "@/features/trips/use-roll-phase";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Loading, Row, Screen, Section } from "@/ui/components";
import { RollDates } from "./roll-dates";
import { useDeleteTrip } from "./use-delete-trip";
import { MAX_TRIP_NAME, nextTripName, useRenameTrip } from "./use-rename-trip";

/** "Ajustes del rollo": name, cover, dates, groups, featuring and leaving/archiving/deleting; the board keeps only what matters now. */
export function RollSettingsScreen({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  return (
    <Screen grouped>
      {error ? (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      ) : !detail ? (
        <Loading />
      ) : (
        <Settings detail={detail} />
      )}
    </Screen>
  );
}

function Settings({ detail }: { detail: TripDetail }) {
  const phase = useRollPhase(detail);
  const event = isEvent(detail.trip);
  const leave = useLeaveTrip(detail.trip.id, detail.trip.name, { revealed: detail.trip.revealed });
  const deleteTrip = useDeleteTrip(detail.trip.id, detail.trip.name);
  const { setArchived } = useArchiveTrip();
  const archived = useActiveTrip().trips.find((t) => t.id === detail.trip.id)?.archived ?? false;
  const rename = useRenameTrip(detail.trip.id);
  const [nameTooLong, setNameTooLong] = useState(false);

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
              setNameTooLong(false);
              rename.mutate(name);
            } else if ((text ?? "").trim().length > MAX_TRIP_NAME) {
              rename.reset();
              setNameTooLong(true);
            }
          },
        },
      ],
      "plain-text",
      detail.trip.name,
    );
  const failure =
    (nameTooLong ? `El nombre puede tener hasta ${MAX_TRIP_NAME} caracteres` : null) ?? errorMessage(rename.error, "No se pudo cambiar el nombre");

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
      {!!failure && <ErrorText>{failure}</ErrorText>}

      {event && <EventCover detail={detail} />}

      <RollDates detail={detail} phase={phase} />

      {event && <EventGroupsSection detail={detail} />}

      <FeaturingSection detail={detail} />

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
      {!!leave.error && <ErrorText>{leave.error}</ErrorText>}

      {detail.me.isCreator && (
        <Section>
          <Row label="Borrar rollo" tone="danger" chevron={false} loading={deleteTrip.deleting} onPress={deleteTrip.deleting ? undefined : deleteTrip.confirm} />
        </Section>
      )}
      {deleteTrip.error && <ErrorText>{deleteTrip.error}</ErrorText>}
    </>
  );
}
