/** Runs a cleanup step after something already succeeded on the server: a failure here is logged, never reported as the action's error. */
export async function bestEffort(step: () => Promise<unknown> | unknown): Promise<void> {
  try {
    await step();
  } catch (error) {
    console.warn("Cleanup after leaving/deleting a rollo failed", error);
  }
}
