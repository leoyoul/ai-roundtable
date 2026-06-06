import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { MeetingMessage, MessageType } from "@/lib/types";
import { nowIso, requireNonEmpty } from "@/lib/validation";

interface AddMessageInput {
  meetingId: string;
  round: number;
  type: MessageType;
  speakerName: string;
  modelId: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

interface UpdateMessageInput {
  type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
}

interface MessageRow {
  id: string;
  meeting_id: string;
  round: number;
  type: MessageType;
  speaker_name: string;
  model_id: string | null;
  content: string;
  metadata_json: string;
  created_at: string;
}

export function addMessage(db: Database.Database, input: AddMessageInput): { id: string; createdAt: string } {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO messages (id, meeting_id, round, type, speaker_name, model_id, content, metadata_json, created_at)
    VALUES (@id, @meetingId, @round, @type, @speakerName, @modelId, @content, @metadataJson, @createdAt)
  `).run({
    id,
    meetingId: input.meetingId,
    round: input.round,
    type: input.type,
    speakerName: input.speakerName,
    modelId: input.modelId,
    content: input.type === "pending" ? input.content : requireNonEmpty(input.content, "content"),
    metadataJson: JSON.stringify(input.metadata),
    createdAt,
  });
  return { id, createdAt };
}

export function updateMessage(db: Database.Database, id: string, input: UpdateMessageInput): void {
  db.prepare(`
    UPDATE messages
    SET type = @type,
        content = @content,
        metadata_json = @metadataJson
    WHERE id = @id
  `).run({
    id,
    type: input.type,
    content: input.type === "pending" ? input.content : requireNonEmpty(input.content, "content"),
    metadataJson: JSON.stringify(input.metadata),
  });
}

export function listMessages(db: Database.Database, meetingId: string): MeetingMessage[] {
  const rows = db.prepare(`
    SELECT * FROM messages WHERE meeting_id = ? ORDER BY created_at ASC
  `).all(meetingId) as MessageRow[];

  return rows.map(mapMessage);
}

function mapMessage(row: MessageRow): MeetingMessage {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    round: row.round,
    type: row.type,
    speakerName: row.speaker_name,
    modelId: row.model_id,
    content: row.content,
    metadata: JSON.parse(row.metadata_json),
    createdAt: row.created_at,
  };
}
