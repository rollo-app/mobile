import type { components } from "@/api/schema";
import type { MomentMode } from "./create-form";
import type { TripDetail } from "./actions";
import { rollPhase } from "./phase";

export type TripSettings = {
  startsAt: number;
  endsAt: number;
  revealAt: number;
  photoLimitMode: "daily" | "total";
  dailyPhotoLimit: number;
  totalPhotoLimit: number | null;
  momentMode: MomentMode;
  momentWindowStart: number;
  momentWindowEnd: number;
};

export type UpdateTripBody = components["schemas"]["UpdateTripRequest"];

export function settingsOf(trip: TripDetail["trip"]): TripSettings {
  return {
    startsAt: trip.startsAt,
    endsAt: trip.endsAt,
    revealAt: trip.revealAt,
    photoLimitMode: trip.photoLimitMode,
    dailyPhotoLimit: trip.dailyPhotoLimit,
    totalPhotoLimit: trip.totalPhotoLimit,
    momentMode: trip.momentMode,
    momentWindowStart: trip.momentWindowStart,
    momentWindowEnd: trip.momentWindowEnd,
  };
}

/** Which settings an admin can still change at this stage of the rollo. */
export function editableFields(trip: TripDetail["trip"], now: number) {
  const phase = rollPhase(trip, now);
  const open = phase === "upcoming" || phase === "active";
  return { start: phase === "upcoming", end: open, reveal: open, limitMode: phase === "upcoming", limit: open, moment: open };
}

export function lockedNote(field: "start" | "limitMode"): string {
  return field === "start" ? "El rollo ya empezó: el inicio no se cambia." : "El rollo ya empezó: el tipo de cupo no se cambia.";
}

export function revealFollowsEnd(s: TripSettings): boolean {
  return s.revealAt === s.endsAt;
}

/** Only what differs, ready for `PATCH /trips/{id}`. `featuringDisabled` is deliberately never part of it. */
export function changedFields(before: TripSettings, after: TripSettings, revealMode: "end" | "custom"): UpdateTripBody {
  const body: UpdateTripBody = {};
  if (after.startsAt !== before.startsAt) body.startsAt = after.startsAt;
  if (after.endsAt !== before.endsAt) body.endsAt = after.endsAt;
  if (revealMode === "end" && after.endsAt !== before.endsAt) body.revealAt = after.endsAt;
  else if (after.revealAt !== before.revealAt) body.revealAt = after.revealAt;

  if (after.photoLimitMode !== before.photoLimitMode) {
    body.photoLimitMode = after.photoLimitMode;
    if (after.photoLimitMode === "total" && after.totalPhotoLimit != null) body.totalPhotoLimit = after.totalPhotoLimit;
    if (after.photoLimitMode === "daily" && after.dailyPhotoLimit !== before.dailyPhotoLimit) body.dailyPhotoLimit = after.dailyPhotoLimit;
  } else if (after.photoLimitMode === "total") {
    if (after.totalPhotoLimit !== before.totalPhotoLimit && after.totalPhotoLimit != null) body.totalPhotoLimit = after.totalPhotoLimit;
  } else if (after.dailyPhotoLimit !== before.dailyPhotoLimit) {
    body.dailyPhotoLimit = after.dailyPhotoLimit;
  }

  if (after.momentMode !== before.momentMode) body.momentMode = after.momentMode;
  if (after.momentWindowStart !== before.momentWindowStart) body.momentWindowStart = after.momentWindowStart;
  if (after.momentWindowEnd !== before.momentWindowEnd) body.momentWindowEnd = after.momentWindowEnd;
  return body;
}

export function canSave(changes: UpdateTripBody): boolean {
  return Object.keys(changes).length > 0;
}
