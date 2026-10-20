import type { StoryStep } from "./story";

export type PlayerState = { steps: StoryStep[]; index: number; paused: boolean };

export type PlayerAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "restart" }
  | { type: "load"; steps: StoryStep[] };

export const initialPlayer = (steps: StoryStep[]): PlayerState => ({ steps, index: 0, paused: false });

/** Navigation of the story as a pure state machine; any move resumes playback. */
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  const { steps, index } = state;
  switch (action.type) {
    case "next":
      return { ...state, index: Math.min(index + 1, steps.length - 1), paused: false };
    case "prev": {
      // Back means "the photo before": day cards are only crossed going forward.
      let i = index - 1;
      while (i > 0 && steps[i]!.kind !== "photo") i--;
      return { ...state, index: Math.max(i, 0), paused: false };
    }
    case "pause":
      return { ...state, paused: true };
    case "resume":
      return { ...state, paused: false };
    case "restart":
      return initialPlayer(steps);
    case "load":
      return initialPlayer(action.steps);
  }
}
