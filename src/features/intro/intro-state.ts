// Whether the new-account intro is being opened or is on screen. Anything that wants to navigate right after sign-up
// (a pending join link) waits for it to end, so the two never fight over the stack.
let busy = false;

export const isIntroBusy = (): boolean => busy;
export const setIntroBusy = (value: boolean): void => {
  busy = value;
};
