import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Extra bottom padding for a `fitToContents` sheet: its content stops where the content ends, so the home-indicator
 * zone is added to the content itself (painted with the content's own background) instead of left to the sheet.
 */
export function useSheetBottomInset(base: number): { paddingBottom: number } {
  const { bottom } = useSafeAreaInsets();
  return { paddingBottom: base + bottom };
}
