import { getDb } from "@/lib/db/connection";
import { deleteModel, updateModel } from "@/lib/db/repositories/models";
import { errorResponse, jsonResponse } from "@/lib/api/responses";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const model = updateModel(getDb(), id, {
      name: body.name,
      baseUrl: body.base_url,
      apiKey: body.api_key ?? null,
      model: body.model,
      identityPrompt: body.identity_prompt ?? "",
      enabled: body.enabled !== false,
    });
    return jsonResponse({ model });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to update model", 400);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    deleteModel(getDb(), id);
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Failed to delete model", 400);
  }
}
