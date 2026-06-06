import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/db/schema";

describe("database schema", () => {
  it("creates required tables", () => {
    const db = new Database(":memory:");
    applySchema(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
    const names = tables.map((table) => table.name);

    expect(names).toContain("models");
    expect(names).toContain("meetings");
    expect(names).toContain("meeting_participants");
    expect(names).toContain("messages");
    expect(names).toContain("round_reports");
    expect(names).toContain("final_reports");
  });
});
