import { SegmentedControl } from "@expo/ui/community/segmented-control";
import { useRouter } from "expo-router";
import { StyleSheet, useColorScheme, View } from "react-native";
import { layout, tintHex } from "@/ui/theme";

const VIEWS = ["Galería", "Rollo"];

/** Fixed width: it fits between the back button and the two buttons on the right even on a 375 pt phone. */
const WIDTH = 168;

/** "Galería | Rollo" as the navigation bar's title view of a revealed roll; the view lives in the `view` route param. */
export function RollViewSwitch({ view }: { view?: string }) {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <View style={styles.box}>
      <SegmentedControl
        values={VIEWS}
        tintColor={tintHex[scheme]}
        selectedIndex={view === "roll" ? 1 : 0}
        onValueChange={(v) => router.setParams({ view: v === "Rollo" ? "roll" : "gallery" })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: WIDTH, height: layout.controlsRowHeight, justifyContent: "center" },
});
