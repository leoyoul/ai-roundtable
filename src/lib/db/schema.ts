import type Database from "better-sqlite3";

export function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key_encrypted TEXT,
      model TEXT NOT NULL,
      identity_prompt TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      status TEXT NOT NULL,
      current_round INTEGER NOT NULL DEFAULT 0,
      convergence_score INTEGER,
      created_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS meeting_participants (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      model_id TEXT,
      sort_order INTEGER NOT NULL,
      display_name_snapshot TEXT NOT NULL,
      base_url_snapshot TEXT NOT NULL,
      model_name_snapshot TEXT NOT NULL,
      identity_prompt_snapshot TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      type TEXT NOT NULL,
      speaker_name TEXT NOT NULL,
      model_id TEXT,
      content TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS round_reports (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      consensus_points_json TEXT NOT NULL,
      disagreement_points_json TEXT NOT NULL,
      open_questions_json TEXT NOT NULL,
      convergence_score INTEGER NOT NULL,
      should_end INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS final_reports (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL UNIQUE,
      markdown TEXT NOT NULL,
      json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_meeting_created ON messages(meeting_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_participants_meeting_order ON meeting_participants(meeting_id, sort_order);
  `);

  ensureColumn(db, "models", "identity_prompt", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "meeting_participants", "identity_prompt_snapshot", "TEXT NOT NULL DEFAULT ''");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
