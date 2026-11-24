import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/features/profile/avatar";
import { useOpenProfile } from "@/features/profile/use-open-profile";
import { useUser } from "@/features/profile/use-user";
import { formatHandle } from "@/features/profile/username";
import { memberActions, memberBadge, type MemberAction } from "@/features/trips/roles";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Row, Section } from "@/ui/components";
import { colors, spacing, type } from "@/ui/theme";
import { useMemberActions } from "./use-member-actions";

const ACTION_TITLES: Record<MemberAction, string> = { makeAdmin: "Hacer admin", removeAdmin: "Quitar admin", remove: "Sacar del rollo" };

/**
 * A member's card (form sheet): big photo, name, @, their description and role, "Ver perfil" and, if you may,
 * the role actions (the long-press menu's twin). The member comes from the trip detail cache, so a role change
 * shows at once; if they're gone (removed) the sheet closes. The description is fetched quietly: no spinner, no error.
 */
export function MemberCardScreen({ tripId, memberId }: { tripId: string | undefined; memberId: string | undefined }) {
  const { detail, error } = useTripDetail(tripId);
  const member = detail?.members.find((m) => m.id === memberId);
  const { profile } = useUser(member?.userId);
  const openProfile = useOpenProfile();
  const actions = useMemberActions(tripId ?? "");

  // The sheet closes once: a removal both finishes the mutation and drops the member from the detail.
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    if (router.canGoBack()) router.back();
  };
  const gone = !!detail && !member;
  useEffect(() => {
    if (gone) close();
  });

  const closeButton = (
    <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={close} hitSlop={8} style={styles.close}>
      <SymbolView name="xmark" size={13} weight="bold" tintColor={colors.secondaryLabel as string} />
    </Pressable>
  );
  if (!detail || !member) {
    return (
      <View style={styles.sheet}>
        {closeButton}
        <View style={styles.empty}>{!!error && <ErrorText>No se pudo cargar.</ErrorText>}</View>
      </View>
    );
  }
  const badge = memberBadge(member);
  const bio = profile?.user.bio;
  const available = memberActions(detail.me, member);
  return (
    <View style={styles.sheet}>
      {closeButton}
      <View style={styles.header}>
        <Avatar id={member.id} name={member.name} avatarUrl={member.avatarUrl} size={96} />
        <Text accessibilityRole="header" style={[type.title, styles.center, { color: colors.label }]}>
          {member.name}
        </Text>
        {!!member.username && <Text style={[type.subhead, styles.center, { color: colors.secondaryLabel }]}>{formatHandle(member.username)}</Text>}
        {!!bio && <Text style={[type.callout, styles.center, { color: colors.label }]}>{bio}</Text>}
        {!!badge && <Text style={[type.footnote, { color: colors.secondaryLabel }]}>{badge}</Text>}
      </View>
      <Button label="Ver perfil" onPress={() => openProfile(member.userId, { leave: true })} />
      {available.length > 0 && (
        <Section>
          {available.map((id) => (
            <Row
              key={id}
              label={ACTION_TITLES[id]}
              tone={id === "remove" ? "danger" : undefined}
              chevron={false}
              disabled={actions.pending}
              loading={actions.pendingAction === id}
              onPress={() => actions.run(id, member, close)}
            />
          ))}
        </Section>
      )}
      {!!actions.failure && <ErrorText>{actions.failure}</ErrorText>}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg, backgroundColor: colors.groupedBackground },
  close: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  header: { alignItems: "center", gap: spacing.xs, paddingTop: spacing.md },
  empty: { minHeight: 120, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
});
