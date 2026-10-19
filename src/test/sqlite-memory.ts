import type { QueueDb } from "@/features/capture/queue";

/** Real in-memory SQLite (node:sqlite) with expo-sqlite's async shape, for tests. */
export function memoryDb(): QueueDb {
  // require at runtime: node:sqlite doesn't exist for the app's bundler.
  const { DatabaseSync } = require("node:sqlite") as { DatabaseSync: new (path: string) => NodeSqlite };
  const db = new DatabaseSync(":memory:");
  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, ...params) => {
      db.prepare(sql).run(...params);
    },
    getAllAsync: async <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[],
  };
}

/** What we use from node:sqlite (without depending on @types/node). */
type NodeSqlite = {
  exec(sql: string): void;
  prepare(sql: string): { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] };
};
