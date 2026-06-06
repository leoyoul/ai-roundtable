import { getDb } from "@/lib/db/connection";
import { createModel, listModels } from "@/lib/db/repositories/models";
import { errorResponse, jsonResponse } from "@/lib/api/responses";

export function GET() {
  return jsonResponse({ models: listModels(getDb()) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const model = createModel(getDb(), {
      name: body.name,
      baseUrl: body.base_url,
      apiKey: body.api_key ?? null,
      model: body.model,
      identityPrompt: body.identity_prompt ?? "",
      enabled: body.enabled !== false,
    });
    return jsonResponse({ model }, 201);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to create model", 400);
  }
}
