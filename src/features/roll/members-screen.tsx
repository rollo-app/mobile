import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { Stack } from "expo-router";
import { useCallback, useDeferredValue, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useSearchBar } from "@/features/friends/use-search-bar";
import type { TripDetail } from "@/features/trips/actions";
import type { MemberAction } from "@/features/trips/roles";
import { useTripDetail } from "@/features/trips/use-trip-detail";
import { Button, ErrorText, Footnote, Loading } from "@/ui/components";
import { colors, radius, spacing } from "@/ui/theme";
import { MemberRow } from "./member-row";
import { filterMembers, orderMembers } from "./members-order";
import { useMemberActions } from "./use-member-actions";

type Member = TripDetail["members"][number];

const keyExtractor = (m: Member) => m.id;

/**
 * "Integrantes": everyone in the roll, same order and row behavior as "En el rollo", with a native search.
 * Virtualized (an event holds up to 200): the rows are drawn as one inset grouped card, like `Section`.
 */
export function MembersScreen({ tripId }: { tripId: string }) {
  const { detail, error, refetch, isRefetching } = useTripDetail(tripId);
  const typed = useSearchBar();
  // Filtering 200 rows per keystroke can wait; the field stays responsive.
  const text = useDeferredValue(typed);
  const actions = useMemberActions(tripId);
  const runRef = useRef(actions.run);
  runRef.current = actions.run;
  const onAction = useCallback((action: MemberAction, m: Member) => runRef.current(action, m), []);

  const me = detail?.me;
  const members = useMemo(() => (detail ? filterMembers(orderMembers(detail.members, detail.me.id), text) : []), [detail, text]);
  const count = members.length;

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Member>) =>
      me ? (
        <View style={[styles.cell, index === 0 && styles.first, index === count - 1 && styles.last]}>
          {index > 0 && <View style={styles.separator} />}
          <MemberRow me={me} member={item} onAction={onAction} />
        </View>
      ) : null,
    [me, count, onAction],
  );

  const showHeader = !!error || (!error && !detail) || (!!detail && count === 0);
  const header = showHeader ? (
    <View style={styles.header}>
      {!!error && (
        <>
          <ErrorText>{error}</ErrorText>
          <Button label="Reintentar" variant="secondary" onPress={() => void refetch()} loading={isRefetching} />
        </>
      )}
      {!error && !detail && <Loading />}
      {detail && count === 0 && <Footnote>No hay integrantes con ese nombre.</Footnote>}
    </View>
  ) : null;
  const footer = actions.failure ? (
    <View style={styles.footer}>
      <ErrorText>{actions.failure}</ErrorText>
    </View>
  ) : null;

  return (
    <>
      <Stack.Screen options={{ title: "Integrantes" }} />
      <FlashList
        data={members}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.groupedBackground },
  content: { padding: spacing.md },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  footer: { marginTop: spacing.lg },
  cell: { backgroundColor: colors.cell, borderCurve: "continuous", overflow: "hidden" },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: spacing.md },
});
