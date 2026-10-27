import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { Screen } from "@/ui/components";
import { colors, spacing, tintHex, type } from "@/ui/theme";
import { ProfileHeader } from "./profile-header";
import { WORST_CASE_FIXTURES, WORST_CASE_LABELS, WORST_CASE_STATES, type WorstCaseState } from "./worst-case-fixtures";

const LABELS = WORST_CASE_STATES.map((s) => WORST_CASE_LABELS[s]);

/**
 * Dev only (break-ui): the profile header fed with demo, worst-case, "one" and minimal data through
 * the same props the real screens use. The state lives in the `state` route param.
 */
export function WorstCaseScreen() {
  const router = useRouter();
  const { state } = useLocalSearchParams<{ state?: string }>();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const current: WorstCaseState = WORST_CASE_STATES.find((s) => s === state) ?? "demo";
  return (
    <View style={styles.root}>
      <View testID="worst-case-state" style={styles.controls}>
        <SegmentedControl
          values={LABELS}
          tintColor={tintHex[scheme]}
          selectedIndex={WORST_CASE_STATES.indexOf(current)}
          onValueChange={(v) => router.setParams({ state: WORST_CASE_STATES[LABELS.indexOf(v)] })}
        />
      </View>
      <Screen grouped>
        {WORST_CASE_FIXTURES[current].map(({ title, props }) => (
          <View key={props.id} style={styles.case}>
            <Text style={[type.caption, styles.caption]}>{title}</Text>
            <ProfileHeader {...props} friends={props.friends && { ...props.friends, onPress: () => {} }} />
          </View>
        ))}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.groupedBackground },
  controls: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  case: { gap: spacing.xs, paddingBottom: spacing.md },
  caption: { color: colors.secondaryLabel },
});
