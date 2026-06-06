import { jsonResponse } from "@/lib/api/responses";
import { getDb } from "@/lib/db/connection";

export function POST() {
  if (process.env.NODE_ENV === "production") {
    return jsonResponse({ ok: false }, 404);
  }

  const db = getDb();
  db.exec(`
    DELETE FROM final_reports;
    DELETE FROM round_reports;
    DELETE FROM messages;
    DELETE FROM meeting_participants;
    DELETE FROM meetings;
    DELETE FROM models;
  `);
  return jsonResponse({ ok: true });
}
