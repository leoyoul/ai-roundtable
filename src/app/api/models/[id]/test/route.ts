import { callChatCompletion } from "@/lib/ai/model-client";
import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getDb } from "@/lib/db/connection";
import { getModelForCall } from "@/lib/db/repositories/models";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const model = getModelForCall(getDb(), id);
  if (!model) {
    return errorResponse("Model not found", 404);
  }
  if (model.keyUnavailable) {
    return jsonResponse({ ok: false, error: "API Key unavailable" }, 502);
  }

  try {
    await callChatCompletion({
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      model: model.model,
      messages: [{ role: "user", content: "请回复 OK" }],
      timeoutMs: 20_000,
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error instanceof Error ? error.message : "Connection failed" }, 502);
  }
}
