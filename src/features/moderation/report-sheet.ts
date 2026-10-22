import { ActionSheetIOS } from "react-native";
import type { ReportReason } from "./actions";
import { REPORT_REASONS, reasonAt } from "./reasons";

/** Asks why with a native action sheet; null if they cancel. */
export function pickReportReason(title: string): Promise<ReportReason | null> {
  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...REPORT_REASONS.map((r) => r.label), "Cancelar"], cancelButtonIndex: REPORT_REASONS.length },
      (index) => resolve(reasonAt(index)),
    );
  });
}
