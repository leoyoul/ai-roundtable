import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getDb } from "@/lib/db/connection";
import { createMeeting, listMeetings } from "@/lib/db/repositories/meetings";

export function GET() {
  return jsonResponse({ meetings: listMeetings(getDb()) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const meeting = createMeeting(getDb(), {
      topic: body.topic,
      modelIds: Array.isArray(body.model_ids) ? body.model_ids : [],
    });
    return jsonResponse({ meeting }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create meeting", 400);
  }
}
