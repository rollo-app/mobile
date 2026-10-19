import type { QueueDb } from "@/features/capture/queue";

/** SQLite real en memoria (node:sqlite) con la forma async de expo-sqlite, para los tests. */
export function memoryDb(): QueueDb {
  // require en runtime: node:sqlite no existe para el bundler de la app.
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

/** Lo que usamos de node:sqlite (sin depender de @types/node). */
type NodeSqlite = {
  exec(sql: string): void;
  prepare(sql: string): { run(...params: unknown[]): unknown; all(...params: unknown[]): unknown[] };
};
