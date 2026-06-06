import http from "node:http";

export function startFakeOpenAiServer(handler: (body: any, index: number) => { status: number; content: string; delayUntil?: Promise<void>; stream?: boolean }) {
  const requests: any[] = [];
  const server = http.createServer((req, res) => {
    if (req.url === "/v1/chat/completions" && req.method === "POST") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const body = JSON.parse(raw);
        requests.push(body);
        const result = handler(body, requests.length);
        if (result.delayUntil) {
          awaitPromise(result.delayUntil, () => writeResponse(res, result));
          return;
        }
        writeResponse(res, result);
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  return new Promise<{ url: string; requests: any[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Invalid fake server address");
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/v1`,
        requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function awaitPromise(promise: Promise<void>, callback: () => void) {
  void promise.then(callback, callback);
}

function writeResponse(res: http.ServerResponse, result: { status: number; content: string; stream?: boolean }) {
  if (res.destroyed) {
    return;
  }
  if (result.stream) {
    res.writeHead(result.status, { "Content-Type": "text/event-stream" });
    for (const chunk of result.content.split(/(\s+)/).filter(Boolean)) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
    }
    res.end("data: [DONE]\n\n");
    return;
  }
  res.writeHead(result.status, { "Content-Type": "application/json" });
  if (result.status >= 400) {
    res.end(JSON.stringify({ error: { message: result.content } }));
    return;
  }
  res.end(JSON.stringify({ choices: [{ message: { content: result.content } }] }));
}
