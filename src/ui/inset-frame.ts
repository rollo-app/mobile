import { StyleSheet } from "react-native";

/** The look of the small second picture of a moment (white border, rounded, portrait): the viewers and the caption share it. */
export const insetFrame = StyleSheet.create({
  frame: {
    width: 72,
    height: 72 * 1.33,
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    backgroundColor: "#222",
  },
});
