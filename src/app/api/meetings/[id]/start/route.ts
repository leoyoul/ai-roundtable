import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getFullMeetingDetail } from "@/lib/api/meeting-detail";
import { getDb } from "@/lib/db/connection";
import { startMeeting } from "@/lib/meeting/orchestrator";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await startMeeting(getDb(), id);
    return jsonResponse(getFullMeetingDetail(getDb(), id));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to start meeting", 400);
  }
}
