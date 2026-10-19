import * as SQLite from "expo-sqlite";
import { createQueue, type Queue } from "./queue";

let queue: Promise<Queue> | null = null;

/** La cola de la app, sobre `rollo.db`. Se abre una sola vez. */
export function getQueue(): Promise<Queue> {
  queue ??= SQLite.openDatabaseAsync("rollo.db").then(createQueue);
  return queue;
}
