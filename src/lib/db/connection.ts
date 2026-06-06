import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { applySchema } from "./schema";

let singleton: Database.Database | null = null;

export function getDatabasePath(): string {
  return process.env.AI_ROUNDTABLE_DB_PATH ?? path.join(process.cwd(), "data", "ai-roundtable.sqlite");
}

export function openDatabase(databasePath = getDatabasePath()): Database.Database {
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

export function getDb(): Database.Database {
  if (!singleton) {
    singleton = openDatabase();
  }
  return singleton;
}
