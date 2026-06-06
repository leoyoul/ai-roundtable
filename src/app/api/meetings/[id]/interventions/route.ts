import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getDb } from "@/lib/db/connection";
import { recordUserIntervention } from "@/lib/meeting/orchestrator";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const message = recordUserIntervention(getDb(), id, body.content);
    return jsonResponse({ message, statusText: "已记录，下一次发言生效" }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to save intervention", 400);
  }
}
