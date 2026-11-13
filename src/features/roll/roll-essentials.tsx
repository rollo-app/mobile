import { router } from "expo-router";
import { Share, StyleSheet, View } from "react-native";
import { isEvent, isOrganizer } from "@/features/events/event";
import { joinLinkUrl } from "@/features/events/join-link";
import { InfoButton } from "@/features/info/info-button";
import { Avatar } from "@/features/profile/avatar";
import type { TripDetail } from "@/features/trips/actions";
import { Row, Section } from "@/ui/components";
import { orderMembers } from "./members-order";

const INVITE_NOTE = "Con este código se suman al rollo. Tocalo para compartir la invitación.";
const FULL_NOTE = "El rollo está lleno. Para sumar a alguien, primero tiene que salir otra persona.";
const FACES = 3;

/** The invite (code, QR, add friends) of a roll. Tapping the code shares the invitation. */
export function RollInvite({ detail }: { detail: TripDetail }) {
  const event = isEvent(detail.trip);
  const full = detail.members.length >= detail.trip.maxMembers;
  const share = () =>
    Share.share({
      message: event
        ? `Sumate a "${detail.trip.name}" en Rollo: ${joinLinkUrl(detail.trip.joinCode)}`
        : `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}`,
    });

  return (
    <Section title="Invitar" titleAccessory={<InfoButton topic="inviteCode" />} footer={full ? FULL_NOTE : INVITE_NOTE}>
      {/* Tapping the code shares the invitation (it used to be its own "Compartir invitación" row). */}
      <Row
        label="Código"
        value={detail.trip.joinCode}
        chevron={false}
        disabled={full}
        accessibilityLabel={`Código ${detail.trip.joinCode}. Compartir invitación`}
        onPress={() => void share()}
      />
      {event && isOrganizer(detail) && !detail.trip.revealed && (
        <Row label="Código QR" disabled={full} onPress={() => router.push({ pathname: "/event-qr", params: { tripId: detail.trip.id } })} />
      )}
      {!event && !detail.trip.revealed && <Row label="Sumar amigos" onPress={() => router.push("/add-friends")} />}
    </Section>
  );
}

/** "Personas · N de M" with the first faces; opens the full list with the member actions. */
export function RollPeopleRow({ detail }: { detail: TripDetail }) {
  const faces = orderMembers(detail.members, detail.me.id).slice(0, FACES);
  return (
    <Section>
      <Row
        label="Personas"
        value={`${detail.members.length} de ${detail.trip.maxMembers}`}
        leading={
          <View style={styles.faces}>
            {faces.map((m, i) => (
              <View key={m.id} style={i > 0 ? styles.overlap : undefined}>
                <Avatar id={m.id} name={m.name} avatarUrl={m.avatarUrl} size={22} />
              </View>
            ))}
          </View>
        }
        onPress={() => router.push({ pathname: "/roll-members", params: { tripId: detail.trip.id } })}
      />
    </Section>
  );
}

/** What a roll's board keeps below the uploads: invite (only before the reveal: nobody joins a revealed roll) and people. */
export function RollEssentials({ detail }: { detail: TripDetail }) {
  return (
    <>
      {!detail.trip.revealed && <RollInvite detail={detail} />}
      <RollPeopleRow detail={detail} />
    </>
  );
}

const styles = StyleSheet.create({
  faces: { flexDirection: "row" },
  overlap: { marginLeft: -8 },
});
