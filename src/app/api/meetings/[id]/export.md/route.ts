import { errorResponse } from "@/lib/api/responses";
import { getDb } from "@/lib/db/connection";
import { getFinalReport } from "@/lib/db/repositories/reports";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const report = getFinalReport(getDb(), id);
  if (!report) {
    return errorResponse("Final report not found", 404);
  }
  return new Response(report.markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="meeting-${id}.md"`,
    },
  });
}
