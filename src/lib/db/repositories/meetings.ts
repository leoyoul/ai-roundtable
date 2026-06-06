import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { Meeting, MeetingParticipant, MeetingStatus } from "@/lib/types";
import { nowIso, requireNonEmpty } from "@/lib/validation";

interface CreateMeetingInput {
  topic: string;
  modelIds: string[];
}

interface MeetingRow {
  id: string;
  topic: string;
  status: MeetingStatus;
  current_round: number;
  convergence_score: number | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface ParticipantRow {
  id: string;
  meeting_id: string;
  model_id: string | null;
  sort_order: number;
  display_name_snapshot: string;
  base_url_snapshot: string;
  model_name_snapshot: string;
  identity_prompt_snapshot: string;
  created_at: string;
}

export function createMeeting(db: Database.Database, input: CreateMeetingInput): Meeting {
  if (input.modelIds.length === 0) {
    throw new Error("At least one model is required");
  }

  const id = crypto.randomUUID();
  const now = nowIso();
  const insertMeeting = db.prepare(`
    INSERT INTO meetings (id, topic, status, current_round, convergence_score, created_at)
    VALUES (@id, @topic, 'draft', 0, NULL, @createdAt)
  `);
  const selectModel = db.prepare(`
    SELECT id, name, base_url, model, identity_prompt FROM models WHERE id = ?
  `);
  const insertParticipant = db.prepare(`
    INSERT INTO meeting_participants (
      id, meeting_id, model_id, sort_order, display_name_snapshot,
      base_url_snapshot, model_name_snapshot, identity_prompt_snapshot, created_at
    )
    VALUES (
      @id, @meetingId, @modelId, @sortOrder, @displayNameSnapshot,
      @baseUrlSnapshot, @modelNameSnapshot, @identityPromptSnapshot, @createdAt
    )
  `);

  db.transaction(() => {
    insertMeeting.run({ id, topic: requireNonEmpty(input.topic, "topic"), createdAt: now });

    input.modelIds.forEach((modelId, index) => {
      const model = selectModel.get(modelId) as { id: string; name: string; base_url: string; model: string; identity_prompt: string } | undefined;
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      insertParticipant.run({
        id: crypto.randomUUID(),
        meetingId: id,
        modelId: model.id,
        sortOrder: index,
        displayNameSnapshot: model.name,
        baseUrlSnapshot: model.base_url,
        modelNameSnapshot: model.model,
        identityPromptSnapshot: model.identity_prompt,
        createdAt: now,
      });
    });
  })();

  return getMeetingDetail(db, id)!.meeting;
}

export function updateMeetingStatus(db: Database.Database, meetingId: string, status: MeetingStatus): void {
  const endedAt = status === "ended" || status === "failed" ? nowIso() : null;
  db.prepare(`
    UPDATE meetings
    SET status = @status,
        started_at = COALESCE(started_at, CASE WHEN @status = 'running' THEN @now ELSE started_at END),
        ended_at = COALESCE(@endedAt, ended_at)
    WHERE id = @meetingId
  `).run({ meetingId, status, now: nowIso(), endedAt });
}

export function updateMeetingProgress(
  db: Database.Database,
  meetingId: string,
  input: { currentRound: number; convergenceScore: number | null; status: MeetingStatus },
): void {
  db.prepare(`
    UPDATE meetings
    SET current_round = @currentRound,
        convergence_score = @convergenceScore,
        status = @status
    WHERE id = @meetingId
  `).run({ meetingId, ...input });
}

export function listMeetings(db: Database.Database): Meeting[] {
  const rows = db.prepare("SELECT * FROM meetings ORDER BY created_at DESC").all() as MeetingRow[];
  return rows.map(mapMeeting);
}

export function getMeetingDetail(db: Database.Database, meetingId: string): { meeting: Meeting; participants: MeetingParticipant[] } | null {
  const meeting = db.prepare("SELECT * FROM meetings WHERE id = ?").get(meetingId) as MeetingRow | undefined;
  if (!meeting) {
    return null;
  }

  const participants = db.prepare(`
    SELECT * FROM meeting_participants WHERE meeting_id = ? ORDER BY sort_order ASC
  `).all(meetingId) as ParticipantRow[];

  return {
    meeting: mapMeeting(meeting),
    participants: participants.map(mapParticipant),
  };
}

function mapMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    topic: row.topic,
    status: row.status,
    currentRound: row.current_round,
    convergenceScore: row.convergence_score,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function mapParticipant(row: ParticipantRow): MeetingParticipant {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    modelId: row.model_id,
    sortOrder: row.sort_order,
    displayNameSnapshot: row.display_name_snapshot,
    baseUrlSnapshot: row.base_url_snapshot,
    modelNameSnapshot: row.model_name_snapshot,
    identityPromptSnapshot: row.identity_prompt_snapshot,
    createdAt: row.created_at,
  };
}
