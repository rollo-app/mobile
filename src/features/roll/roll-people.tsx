import { MenuView } from "@expo/ui/community/menu";
import { router } from "expo-router";
import type { SFSymbol } from "expo-symbols";
import { Alert, Share } from "react-native";
import { errorMessage } from "@/api/client";
import { InfoButton } from "@/features/info/info-button";
import { FeaturingSection } from "@/features/featured/featuring-section";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { formatHandle } from "@/features/profile/username";
import type { TripDetail } from "@/features/trips/actions";
import { canRename, memberActions, memberBadge, type MemberAction } from "@/features/trips/roles";
import { ErrorText, Row, Section } from "@/ui/components";
import { useMakeAdmin } from "./use-make-admin";
import { useRemoveAdmin } from "./use-remove-admin";
import { useRemoveMember } from "./use-remove-member";
import { nextTripName, useRenameTrip } from "./use-rename-trip";

const ACTION_TITLES: Record<MemberAction, string> = { makeAdmin: "Hacer admin", removeAdmin: "Sacar como admin", remove: "Sacar del rollo" };
const ACTION_ICONS: Record<MemberAction, SFSymbol> = { makeAdmin: "person.badge.plus", removeAdmin: "person.badge.minus", remove: "person.fill.xmark" };

/**
 * The invite (code and share) and the members of a roll. Tapping a member (not you) opens their profile.
 */
export function RollPeople({ detail }: { detail: TripDetail }) {
  const openProfile = useOpenProfile();
  const share = () =>
    Share.share({ message: `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}` });

  const leave = useLeaveTrip(detail.trip.id, detail.trip.name, { revealed: detail.trip.revealed });
  const makeAdmin = useMakeAdmin(detail.trip.id);
  const removeAdmin = useRemoveAdmin(detail.trip.id);
  const removeMember = useRemoveMember(detail.trip.id);
  const rename = useRenameTrip(detail.trip.id);

  const confirmRemove = (memberId: string, name: string) =>
    Alert.alert(`¿Sacar a ${name} del rollo?`, "Sus fotos se quedan. Solo un admin lo puede volver a sumar.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sacar", style: "destructive", onPress: () => removeMember.mutate(memberId) },
    ]);
  const run = (action: MemberAction, m: TripDetail["me"]) => {
    if (action === "makeAdmin") makeAdmin.mutate(m.id);
    else if (action === "removeAdmin") removeAdmin.mutate(m.id);
    else confirmRemove(m.id, m.name);
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
            if (name) rename.mutate(name);
          },
        },
      ],
      "plain-text",
      detail.trip.name,
    );
  const failure =
    errorMessage(makeAdmin.error, "No se pudo hacer admin") ??
    errorMessage(removeAdmin.error, "No se pudo sacar como admin") ??
    errorMessage(removeMember.error, "No se pudo sacar del rollo") ??
    errorMessage(rename.error, "No se pudo cambiar el nombre");

  return (
    <>
      {canRename(detail.me) && (
        <Section>
          <Row label="Nombre" value={detail.trip.name} onPress={editName} />
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

      {!detail.me.isCreator && (
        <Section>
          <Row label="Salirme del rollo" tone="danger" chevron={false} loading={leave.leaving} onPress={leave.leaving ? undefined : leave.confirm} />
        </Section>
      )}
      {leave.error && <ErrorText>{leave.error}</ErrorText>}
    </>
  );
}
