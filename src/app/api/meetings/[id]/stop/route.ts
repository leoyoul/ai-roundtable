import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getFullMeetingDetail } from "@/lib/api/meeting-detail";
import { getDb } from "@/lib/db/connection";
import { stopMeeting } from "@/lib/meeting/orchestrator";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    stopMeeting(getDb(), id);
    return jsonResponse(getFullMeetingDetail(getDb(), id));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to stop meeting", 400);
  }
}
