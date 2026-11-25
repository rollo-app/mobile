import { eventDay, isEvent, joinedLine } from "@/features/events/event";
import { joinLinkUrl } from "@/features/events/join-link";
import type { TripDetail } from "@/features/trips/actions";
import { memberTotal } from "@/features/trips/member-total";
import { type RGB, thumbHashAverageColor } from "@/features/trips/thumbhash-color";
import { dateRange } from "./collage";

/** Same condition `RollInvite` uses to show the code: not revealed yet and with room left. */
export const canShareInvite = (detail: TripDetail): boolean =>
  !detail.trip.revealed && detail.members.length < detail.trip.maxMembers;

/** The line under the name on the invitation image. */
export function inviteCaption(detail: TripDetail): string {
  const { trip } = detail;
  if (isEvent(trip) && trip.coverUrl) {
    const total = memberTotal(detail);
    return `${eventDay(trip.startsAt, trip.timezone)} · ${joinedLine(total >= 5 ? total : null)}`;
  }
  return `${dateRange(trip.startsAt, trip.endsAt, trip.timezone)} · sin revelar`;
}

/** Average colors of the thumbhashes that exist, up to `max`; they paint the blurred mosaic. */
export function inviteSwatches(thumbhashes: (string | null)[], max = 16): RGB[] {
  const colors: RGB[] = [];
  for (const hash of thumbhashes) {
    if (colors.length >= max) break;
    const color = hash ? thumbHashAverageColor(hash) : null;
    if (color) colors.push(color);
  }
  return colors;
}

export const inviteLink = (detail: TripDetail): string => joinLinkUrl(detail.trip.joinCode);
