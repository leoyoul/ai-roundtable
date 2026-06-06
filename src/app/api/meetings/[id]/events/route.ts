import { getFullMeetingDetail } from "@/lib/api/meeting-detail";
import { getDb } from "@/lib/db/connection";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const encoder = new TextEncoder();
  let lastPayload = "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setInterval> | null = null;
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) {
          clearInterval(timer);
        }
        controller.close();
      };
      const send = () => {
        if (closed || request.signal.aborted) {
          close();
          return;
        }

        const detail = getFullMeetingDetail(getDb(), id);
        if (!detail) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Meeting not found" })}\n\n`));
          close();
          return;
        }

        const payload = JSON.stringify(detail);
        if (payload !== lastPayload) {
          lastPayload = payload;
          controller.enqueue(encoder.encode(`event: detail\ndata: ${payload}\n\n`));
        } else {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        }

        if (!["discussing", "judging"].includes(detail.viewState.phase)) {
          close();
        }
      };

      send();
      timer = setInterval(send, 250);
      request.signal.addEventListener("abort", () => {
        close();
      }, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
