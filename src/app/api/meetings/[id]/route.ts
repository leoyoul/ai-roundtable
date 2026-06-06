import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getFullMeetingDetail } from "@/lib/api/meeting-detail";
import { getDb } from "@/lib/db/connection";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const detail = getFullMeetingDetail(getDb(), id);
  if (!detail) {
    return errorResponse("Meeting not found", 404);
  }
  return jsonResponse(detail);
}
