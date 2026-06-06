import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { FinalReport, RoundReport } from "@/lib/types";
import { nowIso } from "@/lib/validation";

interface SaveRoundReportInput {
  meetingId: string;
  round: number;
  consensusPoints: string[];
  disagreementPoints: string[];
  openQuestions: string[];
  convergenceScore: number;
  shouldEnd: boolean;
  reason: string;
}

interface SaveFinalReportInput {
  meetingId: string;
  markdown: string;
  json: string;
}

interface RoundReportRow {
  id: string;
  meeting_id: string;
  round: number;
  consensus_points_json: string;
  disagreement_points_json: string;
  open_questions_json: string;
  convergence_score: number;
  should_end: number;
  reason: string;
  created_at: string;
}

interface FinalReportRow {
  id: string;
  meeting_id: string;
  markdown: string;
  json: string;
  created_at: string;
}

export function saveRoundReport(db: Database.Database, input: SaveRoundReportInput): { id: string; createdAt: string } {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO round_reports (
      id, meeting_id, round, consensus_points_json, disagreement_points_json,
      open_questions_json, convergence_score, should_end, reason, created_at
    )
    VALUES (
      @id, @meetingId, @round, @consensusPointsJson, @disagreementPointsJson,
      @openQuestionsJson, @convergenceScore, @shouldEnd, @reason, @createdAt
    )
  `).run({
    id,
    meetingId: input.meetingId,
    round: input.round,
    consensusPointsJson: JSON.stringify(input.consensusPoints),
    disagreementPointsJson: JSON.stringify(input.disagreementPoints),
    openQuestionsJson: JSON.stringify(input.openQuestions),
    convergenceScore: input.convergenceScore,
    shouldEnd: input.shouldEnd ? 1 : 0,
    reason: input.reason,
    createdAt,
  });
  return { id, createdAt };
}

export function listRoundReports(db: Database.Database, meetingId: string): RoundReport[] {
  const rows = db.prepare(`
    SELECT * FROM round_reports WHERE meeting_id = ? ORDER BY round ASC
  `).all(meetingId) as RoundReportRow[];
  return rows.map(mapRoundReport);
}

export function saveFinalReport(db: Database.Database, input: SaveFinalReportInput): { id: string; createdAt: string } {
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`
    INSERT INTO final_reports (id, meeting_id, markdown, json, created_at)
    VALUES (@id, @meetingId, @markdown, @json, @createdAt)
    ON CONFLICT(meeting_id) DO UPDATE SET markdown = excluded.markdown, json = excluded.json, created_at = excluded.created_at
  `).run({ id, meetingId: input.meetingId, markdown: input.markdown, json: input.json, createdAt });
  return { id, createdAt };
}

export function getFinalReport(db: Database.Database, meetingId: string): FinalReport | null {
  const row = db.prepare("SELECT * FROM final_reports WHERE meeting_id = ?").get(meetingId) as FinalReportRow | undefined;
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    meetingId: row.meeting_id,
    markdown: row.markdown,
    json: row.json,
    createdAt: row.created_at,
  };
}

function mapRoundReport(row: RoundReportRow): RoundReport {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    round: row.round,
    consensusPoints: JSON.parse(row.consensus_points_json),
    disagreementPoints: JSON.parse(row.disagreement_points_json),
    openQuestions: JSON.parse(row.open_questions_json),
    convergenceScore: row.convergence_score,
    shouldEnd: row.should_end === 1,
    reason: row.reason,
    createdAt: row.created_at,
  };
}
