import * as SQLite from "expo-sqlite";
import { createQueue, type Queue } from "./queue";

let queue: Promise<Queue> | null = null;

/** The app's queue, on `rollo.db`. Opened only once. */
export function getQueue(): Promise<Queue> {
  queue ??= SQLite.openDatabaseAsync("rollo.db").then(createQueue);
  return queue;
}
