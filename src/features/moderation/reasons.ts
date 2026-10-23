import type { ReportReason } from "./actions";

export const REPORT_REASONS: readonly { reason: ReportReason; label: string }[] = [
  { reason: "offensive", label: "Es ofensivo" },
  { reason: "abuse", label: "Es acoso o abuso" },
  { reason: "other", label: "Otro motivo" },
];

/** The reason for an action sheet button index; the cancel button (last) and anything out of range give null. */
export function reasonAt(index: number): ReportReason | null {
  return REPORT_REASONS[index]?.reason ?? null;
}
