import { MenuView } from "@expo/ui/community/menu";
import type { SFSymbol } from "expo-symbols";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { formatHandle } from "@/features/profile/username";
import type { TripDetail } from "@/features/trips/actions";
import { memberActions, memberBadge, type MemberAction } from "@/features/trips/roles";
import { Row } from "@/ui/components";

type Member = TripDetail["members"][number];

const ACTION_TITLES: Record<MemberAction, string> = { makeAdmin: "Hacer admin", removeAdmin: "Quitar admin", remove: "Sacar del rollo" };
const ACTION_ICONS: Record<MemberAction, SFSymbol> = { makeAdmin: "person.badge.plus", removeAdmin: "person.badge.minus", remove: "person.fill.xmark" };

/**
 * One member: photo, name, @, role badge. Tapping (not you) opens their profile; long-press (and VoiceOver actions)
 * offer the role changes `me` is allowed. Used by "En el rollo" and the full members list.
 */
export function MemberRow({ me, member: m, onAction }: { me: Member; member: Member; onAction: (action: MemberAction, m: Member) => void }) {
  const openProfile = useOpenProfile();
  const actions = memberActions(me, m);
  const badge = memberBadge(m);
  const row = (
    <Row
      leading={<Avatar id={m.id} name={m.name} avatarUrl={m.avatarUrl} size={40} />}
      label={m.name}
      detail={m.username ? formatHandle(m.username) : undefined}
      value={m.blockedByMe ? "Bloqueado" : (badge ?? undefined)}
      onPress={m.userId === me.userId ? undefined : () => openProfile(m.userId)}
      accessibilityActions={actions.map((id) => ({ name: id, label: ACTION_TITLES[id] }))}
      onAccessibilityAction={(name) => onAction(name as MemberAction, m)}
    />
  );
  if (actions.length === 0) return row;
  return (
    <MenuView
      shouldOpenOnLongPress
      actions={actions.map((id) => ({
        id,
        title: ACTION_TITLES[id],
        image: ACTION_ICONS[id],
        ...(id === "remove" && { attributes: { destructive: true } }),
      }))}
      onPressAction={({ nativeEvent }) => onAction(nativeEvent.event as MemberAction, m)}
    >
      {row}
    </MenuView>
  );
}
