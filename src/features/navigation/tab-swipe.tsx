import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { SwipeTab } from "./swipe-targets";
import { useTabSwipe } from "./use-tab-swipe";

/** Wraps a tab's content so a horizontal drag moves to the neighbor tab (Rollo · Feed · Perfil). */
export function TabSwipe({ current, children }: { current: SwipeTab; children: ReactNode }) {
  const handlers = useTabSwipe(current);
  return (
    <View testID={`tab-swipe-${current}`} style={styles.fill} {...handlers}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
