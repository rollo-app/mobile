export const TODAY_ACTION = "today";
export const MOMENTS_ACTION = "moments";
export const ALL_ACTION = "all";

/** What the user has picked in the filter menu. */
export type FilterState = { today: boolean; moments: boolean; authorId: string | null };

type MenuAction = {
  id: string;
  title: string;
  image?: "calendar" | "bolt";
  state?: "on" | "off";
  displayInline?: boolean;
  subactions?: MenuAction[];
};

const on = (yes: boolean) => (yes ? ("on" as const) : ("off" as const));

/**
 * The actions of the filter menu: "Solo hoy" (only while the roll has a today), "Momentos" (offered once
 * the roll has any moment) and the people, inline.
 */
export function buildFilterActions(input: {
  hasToday: boolean;
  hasMoments: boolean;
  today: boolean;
  momentsOnly: boolean;
  authorId: string | null;
  members: { id: string; name: string }[];
}): MenuAction[] {
  const { hasToday, hasMoments, today, momentsOnly, authorId, members } = input;
  return [
    ...(hasToday ? [{ id: TODAY_ACTION, title: "Solo hoy", image: "calendar" as const, state: on(today) }] : []),
    ...(hasMoments ? [{ id: MOMENTS_ACTION, title: "Momentos", image: "bolt" as const, state: on(momentsOnly) }] : []),
    {
      id: "people",
      title: "Personas",
      displayInline: true,
      subactions: [
        { id: ALL_ACTION, title: "Todos", state: on(authorId === null) },
        ...members.map((m) => ({ id: m.id, title: m.name, state: on(authorId === m.id) })),
      ],
    },
  ];
}

/** The filters after the user presses a menu action. */
export function applyFilterAction(state: FilterState, id: string): FilterState {
  if (id === TODAY_ACTION) return { ...state, today: !state.today };
  if (id === MOMENTS_ACTION) return { ...state, moments: !state.moments };
  return { ...state, authorId: id === ALL_ACTION ? null : id };
}
