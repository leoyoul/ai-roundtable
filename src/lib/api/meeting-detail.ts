import type Database from "better-sqlite3";
import { getMeetingDetail } from "@/lib/db/repositories/meetings";
import { listMessages } from "@/lib/db/repositories/messages";
import { getFinalReport, listRoundReports } from "@/lib/db/repositories/reports";
import { deriveMeetingViewState } from "@/lib/meeting/meeting-view-state";

export function getFullMeetingDetail(db: Database.Database, meetingId: string) {
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) {
    return null;
  }

  const messages = listMessages(db, meetingId);
  const roundReports = listRoundReports(db, meetingId);
  const finalReport = getFinalReport(db, meetingId);

  return {
    ...detail,
    messages,
    roundReports,
    finalReport,
    viewState: deriveMeetingViewState({
      meeting: detail.meeting,
      participants: detail.participants,
      messages,
      hasFinalReport: Boolean(finalReport),
    }),
  };
}
