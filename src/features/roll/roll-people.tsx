import { router } from "expo-router";
import { Share } from "react-native";
import { useLeaveTrip } from "@/features/friends/use-leave-trip";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { formatHandle } from "@/features/profile/username";
import type { TripDetail } from "@/features/trips/actions";
import { ErrorText, Row, Section } from "@/ui/components";

/**
 * The invite (code and share) and the members of a roll. Tapping a member (not you) opens their
 * profile; `inSheet` (the "Sobre el rollo" sheet) closes the sheet first.
 */
export function RollPeople({ detail, inSheet = false }: { detail: TripDetail; inSheet?: boolean }) {
  const openProfile = useOpenProfile();
  const share = () =>
    Share.share({ message: `Sumate a "${detail.trip.name}" en Rollo con el código ${detail.trip.joinCode}` });

  const leave = useLeaveTrip(detail.trip.id, detail.trip.name);

  return (
    <>
      {!detail.trip.revealed && (
        <Section>
          <Row label="Sumar amigos" onPress={() => router.push("/add-friends")} />
        </Section>
      )}

      <Section title="Invitar" footer="Con este código se suman al rollo.">
        <Row label="Código" value={detail.trip.joinCode} />
        <Row label="Compartir invitación" onPress={() => void share()} />
      </Section>

      <Section title={`En el rollo · ${detail.members.length}`}>
        {detail.members.map((m) => (
          <Row
            key={m.id}
            leading={<Avatar id={m.id} name={m.name} avatarUrl={m.avatarUrl} size={40} />}
            label={m.name}
            detail={m.username ? formatHandle(m.username) : undefined}
            value={m.role === "admin" ? "Admin" : undefined}
            onPress={m.userId === detail.me.userId ? undefined : () => openProfile(m.userId, { leave: inSheet })}
          />
        ))}
      </Section>

      <Section>
        <Row label="Salirme del rollo" tone="danger" loading={leave.leaving} onPress={leave.leaving ? undefined : leave.confirm} />
      </Section>
      {leave.error && <ErrorText>{leave.error}</ErrorText>}
    </>
  );
}
