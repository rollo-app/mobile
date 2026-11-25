import type { ComponentProps } from "react";
import type { ProfileHeader } from "./profile-header";
import type { ProfileStatsInput } from "./profile-stats";

type HeaderProps = ComponentProps<typeof ProfileHeader>;
/** Same props the real screens pass; `stats.onPressFriends` is filled in by the dev screen. */
export type FixtureProps = Omit<HeaderProps, "stats"> & { stats?: ProfileStatsInput };
export type Fixture = { title: string; props: FixtureProps };

/** Limits from the backend contract (`src/api/schema.d.ts`, backend `schemas.ts`). */
export const NAME_MAX = 30;
export const USERNAME_MAX = 30;
export const BIO_MAX = 150;

export const WORST_CASE_STATES = ["demo", "worst", "one", "minimal"] as const;
export type WorstCaseState = (typeof WORST_CASE_STATES)[number];
export const WORST_CASE_LABELS: Record<WorstCaseState, string> = { demo: "Demo", worst: "Peor caso", one: "Uno", minimal: "Mínimo" };

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BIO_150 = "Fotógrafa de viajes y rutas. Sur, siempre el sur. Si hay señal, mando fotos; si no, las guardo para revelar después con todos los amigos del rollo ya."; // 150
const BIO_3_LINES = "Viajo con cámara\nEl sur, la ruta 40\nY mate, mucho mate";

const base = (n: number, over: Partial<FixtureProps>): FixtureProps => ({
  id: ID(n), name: "Juani", username: "juani", avatarUrl: null, bio: null, badge: null, ...over,
});

export const WORST_CASE_FIXTURES: Record<WorstCaseState, Fixture[]> = {
  demo: [
    { title: "Demo", props: base(1, { name: "Cami", username: "cami", bio: "Viajando por el sur", badge: "founder", stats: { rolls: 8, photos: 34, friends: 12, mutual: 3, canSee: true } }) },
  ],
  worst: [
    { title: "Name 30 chars, hyphenated, diacritics + longest @username + FIRST EDITION + 1.284 rollos, 12.840 amigos, 1.284 en común", props: base(2, { name: "Aleksandra Wiśniewska-Kowalczy", username: "a_very.long_username_thirty_c1", badge: "first_edition", stats: { rolls: 1284, photos: 60, friends: 12840, mutual: 1284 } }) },
    { title: "Name 30 chars, one unbreakable word", props: base(3, { name: "Wolfeschlegelsteinhausenberger", username: "wolfe", stats: { rolls: 999_999, photos: 1_000_000, friends: 1_000_000, canSee: true } }) },
    { title: "Emoji first (ZWJ) + bio at 150 chars", props: base(4, { name: "👩🏽‍💻 Priya", username: "priya", bio: BIO_150, stats: { rolls: 2, photos: 9, friends: 2, mutual: 1, canSee: true } }) },
    { title: "Name starts with ß / symbol, 3-line bio", props: base(5, { name: "ßeta (la rubia)", username: "beta", bio: BIO_3_LINES, badge: "founder" }) },
    { title: "CJK name", props: base(6, { name: "王秀英", username: "xiuying" }) },
    { title: "RTL name", props: base(7, { name: "نور الهدى عبد الرحمن", username: "nour", bio: "مصورة" }) },
    { title: "Vietnamese stacked diacritics", props: base(8, { name: "Đặng Thị Ngọc Hân", username: "han" }) },
    { title: "Broken avatar URL (404)", props: base(9, { name: "Seán O'Brien-Ó Súilleabháin", username: "sean", avatarUrl: "/avatars/does-not-exist/404.jpg" }) },
    { title: "Unknown badge value from a newer server", props: base(10, { name: "Dana", username: "dana", badge: "mystery" }) },
    { title: "Someone else's hidden list: count with no mutuals", props: base(11, { name: "Lu", username: "lulu", stats: { friends: 40, mutual: 0, canSee: false } }) },
  ],
  one: [
    { title: "1 roll, 1 photo, 1 friend, 1 in common", props: base(12, { name: "Fede", username: "fede", stats: { rolls: 1, photos: 1, friends: 1, mutual: 1 } }) },
    { title: "1 roll, 1 photo, 1 friend, no mutuals", props: base(13, { name: "Fede", username: "fede", stats: { rolls: 1, photos: 1, friends: 1, canSee: true } }) },
    { title: "Name of 1 letter", props: base(14, { name: "J", username: "jjj", bio: "x" }) },
    { title: "Name of 2 letters (Jo)", props: base(15, { name: "Jo", username: "jo.jo" }) },
  ],
  minimal: [
    { title: "Only name (no @, bio, photo, badge, friends)", props: base(16, { username: null, name: "Sam" }) },
    { title: "nothing to count on someone else's profile (line hidden)", props: base(17, { name: "Sam", username: "sam", stats: { friends: 0, mutual: 0, canSee: true } }) },
    { title: "nothing yet on your own profile (\"Todavía no tenés amigos\")", props: base(20, { name: "Sam", username: "sam", stats: { rolls: 0, photos: 0, friends: 0, own: true } }) },
    { title: "Empty name (profile not completed)", props: base(18, { name: "", username: null }) },
    { title: "Whitespace name", props: base(19, { name: "   ", username: "sam" }) },
  ],
};
