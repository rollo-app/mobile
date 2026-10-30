import { MenuView } from "@expo/ui/community/menu";
import { router } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { useState } from "react";
import { Alert, Share } from "react-native";
import { errorMessage } from "@/api/client";
import { InfoButton } from "@/features/info/info-button";
import { FeaturingSection } from "@/features/featured/featuring-section";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { formatHandle } from "@/features/profile/username";
import type { TripDetail } from "@/features/trips/actions";
import { useActiveTrip } from "@/features/trips/use-active-trip";
import { editableFields } from "@/features/trips/edit-form";
import { useArchiveTrip } from "@/features/trips/use-archive-trip";
import { canRename, memberActions, memberBadge, type MemberAction } from "@/features/trips/roles";
import { ErrorText, Row, Section } from "@/ui/components";
import { useDeleteTrip } from "./use-delete-trip";
import { useMakeAdmin } from "./use-make-admin";
import { useRemoveAdmin } from "./use-remove-admin";
import { useRemoveMember } from "./use-remove-member";
import { MAX_TRIP_NAME, nextTripName, useRenameTrip } from "./use-rename-trip";

const ACTION_TITLES: Record<MemberAction, string> = { makeAdmin: "Hacer admin", removeAdmin: "Quitar admin", remove: "Sacar del rollo" };
const ACTION_ICONS: Record<MemberAction, SFSymbol> = { makeAdmin: "person.badge.plus", removeAdmin: "person.badge.minus", remove: "person.fill.xmark" };

/**
 * The invite (code and share) and the members of a roll. Tapping a member (not you) opens their profile.
 */
export function RollPeople({ detail }: { detail: TripDetail }) {
  const openProfile = useOpenProfile();
  const share = () =>
    Share.share({ message: `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}` });

  const leave = useLeaveTrip(detail.trip.id, detail.trip.name, { revealed: detail.trip.revealed });
  const deleteTrip = useDeleteTrip(detail.trip.id, detail.trip.name);
  const { setArchived } = useArchiveTrip();
  const archived = useActiveTrip().trips.find((t) => t.id === detail.trip.id)?.archived ?? false;
  const makeAdmin = useMakeAdmin(detail.trip.id);
  const removeAdmin = useRemoveAdmin(detail.trip.id);
  const removeMember = useRemoveMember(detail.trip.id);
  const rename = useRenameTrip(detail.trip.id);
  const [nameTooLong, setNameTooLong] = useState(false);
  // Only the latest action's error shows: starting one clears the others.
  const start = (keep: { reset: () => void }) => {
    for (const m of [makeAdmin, removeAdmin, removeMember, rename]) if (m !== keep) m.reset();
    setNameTooLong(false);
  };

  const confirmRemove = (memberId: string, name: string) =>
    Alert.alert(`¿Sacar a ${name} del rollo?`, "Sus fotos se quedan. Solo un admin lo puede volver a sumar.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sacar",
        style: "destructive",
        onPress: () => {
          start(removeMember);
          removeMember.mutate(memberId);
        },
      },
    ]);
  const run = (action: MemberAction, m: TripDetail["me"]) => {
    if (action === "makeAdmin") {
      start(makeAdmin);
      makeAdmin.mutate(m.id);
    } else if (action === "removeAdmin") {
      start(removeAdmin);
      removeAdmin.mutate(m.id);
    } else confirmRemove(m.id, m.name);
  };
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
              start(rename);
              rename.mutate(name);
            } else if ((text ?? "").trim().length > MAX_TRIP_NAME) {
              start(rename);
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
    errorMessage(makeAdmin.error, "No se pudo hacer admin") ??
    errorMessage(removeAdmin.error, "No se pudo quitar como admin") ??
    errorMessage(removeMember.error, "No se pudo sacar del rollo") ??
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
        {detail.members.map((m) => {
          const actions = memberActions(detail.me, m);
          const badge = memberBadge(m);
          const row = (
            <Row
              key={m.id}
              leading={<Avatar id={m.id} name={m.name} avatarUrl={m.avatarUrl} size={40} />}
              label={m.name}
              detail={m.username ? formatHandle(m.username) : undefined}
              value={m.blockedByMe ? "Bloqueado" : (badge ?? undefined)}
              onPress={m.userId === detail.me.userId ? undefined : () => openProfile(m.userId)}
              accessibilityActions={actions.map((id) => ({ name: id, label: ACTION_TITLES[id] }))}
              onAccessibilityAction={(name) => run(name as MemberAction, m)}
            />
          );
          if (actions.length === 0) return row;
          return (
            <MenuView
              key={m.id}
              shouldOpenOnLongPress
              actions={actions.map((id) => ({
                id,
                title: ACTION_TITLES[id],
                image: ACTION_ICONS[id],
                ...(id === "remove" && { attributes: { destructive: true } }),
              }))}
              onPressAction={({ nativeEvent }) => run(nativeEvent.event as MemberAction, m)}
            >
              {row}
            </MenuView>
          );
        })}
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
