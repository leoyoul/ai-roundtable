import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getDb } from "@/lib/db/connection";
import { finalizeMeeting } from "@/lib/meeting/orchestrator";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await finalizeMeeting(getDb(), id);
    if (!result.ok) {
      return jsonResponse(result, 502);
    }
    return jsonResponse({ ok: true, finalReport: result.finalReport });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to finalize meeting", 400);
  }
}
