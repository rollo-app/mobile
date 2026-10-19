import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { listTrips } from "@/storage/trips";
import { runUploadPass } from "./sync";

/**
 * Uploads the queue while the app is not open. iOS wakes the app now and then (BGProcessingTask,
 * only with network) and runs this task headless: there is no UI, so it only uploads. The
 * foreground triggers (`useSyncTriggers`) still invalidate the queries when the app comes back.
 */

export const UPLOAD_TASK = "rollo-upload";

/** Time we allow ourselves per wake-up; the pass ends between items when it runs out. */
export const BACKGROUND_BUDGET_MS = 25_000;

/** Minutes between wake-ups (15 is the minimum; iOS decides the real moment). */
const MINIMUM_INTERVAL_MIN = 15;

/** One upload pass with a time budget. Never throws: it returns the result iOS expects. */
export async function runBackgroundUpload(): Promise<BackgroundTask.BackgroundTaskResult> {
  try {
    await runUploadPass({ deadline: Date.now() + BACKGROUND_BUDGET_MS });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn("Falló la subida en segundo plano", e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

// Must be at module level and imported before rendering (app/_layout.tsx), because iOS can launch
// the app in the background just to run the task.
TaskManager.defineTask(UPLOAD_TASK, runBackgroundUpload);

/** Registers the task if there are saved trips. Idempotent; never throws. */
export async function registerBackgroundUpload(): Promise<void> {
  try {
    if ((await listTrips()).length === 0) return;
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    await BackgroundTask.registerTaskAsync(UPLOAD_TASK, { minimumInterval: MINIMUM_INTERVAL_MIN });
  } catch (e) {
    console.warn("No se pudo registrar la subida en segundo plano", e);
  }
}

/** Dev only: asks iOS to run the registered tasks right now. */
export async function triggerBackgroundUploadForTesting(): Promise<boolean> {
  return BackgroundTask.triggerTaskWorkerForTestingAsync();
}
