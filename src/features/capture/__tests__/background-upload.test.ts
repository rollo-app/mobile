import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { setSessionToken } from "@/storage/session";
import * as sync from "../sync";
import {
  BACKGROUND_BUDGET_MS,
  registerBackgroundUpload,
  runBackgroundUpload,
  triggerBackgroundUploadForTesting,
  UPLOAD_TASK,
} from "../background-upload";

describe("background upload task", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is defined at module level under the rollo-upload name", () => {
    expect(UPLOAD_TASK).toBe("rollo-upload");
    expect((TaskManager as unknown as { __tasks: Map<string, unknown> }).__tasks.get(UPLOAD_TASK)).toBe(runBackgroundUpload);
  });

  it("runs one upload pass with a deadline equal to the time budget and reports success", async () => {
    const pass = jest.spyOn(sync, "runUploadPass").mockResolvedValue();
    const before = Date.now();

    const result = await runBackgroundUpload();

    expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
    const { deadline } = pass.mock.calls[0]![0]!;
    expect(deadline).toBeGreaterThanOrEqual(before + BACKGROUND_BUDGET_MS);
    expect(deadline).toBeLessThanOrEqual(Date.now() + BACKGROUND_BUDGET_MS);
  });

  it("reports failure without throwing when the pass blows up", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(sync, "runUploadPass").mockRejectedValue(new Error("sqlite"));

    await expect(runBackgroundUpload()).resolves.toBe(BackgroundTask.BackgroundTaskResult.Failed);
  });
});

describe("registerBackgroundUpload", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does nothing when signed out", async () => {
    await registerBackgroundUpload();

    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("registers the task with a 15 minute minimum interval when signed in", async () => {
    await setSessionToken("tok");

    await registerBackgroundUpload();

    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith(UPLOAD_TASK, { minimumInterval: 15 });
  });

  it("does not register when background tasks are restricted", async () => {
    await setSessionToken("tok");
    jest.mocked(BackgroundTask.getStatusAsync).mockResolvedValueOnce(BackgroundTask.BackgroundTaskStatus.Restricted);

    await registerBackgroundUpload();

    expect(BackgroundTask.registerTaskAsync).not.toHaveBeenCalled();
  });

  it("never throws if registering fails", async () => {
    await setSessionToken("tok");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.mocked(BackgroundTask.registerTaskAsync).mockRejectedValueOnce(new Error("denied"));

    await expect(registerBackgroundUpload()).resolves.toBeUndefined();
  });
});

describe("triggerBackgroundUploadForTesting", () => {
  it("asks the system to run the registered tasks now", async () => {
    await triggerBackgroundUploadForTesting();

    expect(BackgroundTask.triggerTaskWorkerForTestingAsync).toHaveBeenCalled();
  });
});
