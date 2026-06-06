import { describe, expect, it, vi } from "vitest";
import { callChatCompletion } from "@/lib/ai/model-client";

describe("model client", () => {
  it("calls OpenAI-compatible chat completions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "hello" } }],
      }),
    });

    const result = await callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.content).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
  });

  it("omits authorization header when api key is empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "local" } }] }),
    });

    await callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      model: "local-model",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("reads OpenAI-compatible streaming responses", async () => {
    const encoder = new TextEncoder();
    const chunks: string[] = [];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "你" } }] })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "好" } }] })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
      json: async () => ({ choices: [{ message: { content: "fallback" } }] }),
    });

    const result = await callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      model: "local-model",
      messages: [{ role: "user", content: "hi" }],
      preferStream: true,
      onToken: (content) => chunks.push(content),
    });

    expect(result.content).toBe("你好");
    expect(chunks).toEqual(["你", "你好"]);
  });

  it("separates streaming reasoning tokens from visible content", async () => {
    const encoder = new TextEncoder();
    const streamChunks: Array<{ content: string; reasoningContent: string; phase: string }> = [];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "先分析" } }] })}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "结论" } }] })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: stream,
      json: async () => ({ choices: [{ message: { content: "fallback" } }] }),
    });

    const result = await callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      model: "local-model",
      messages: [{ role: "user", content: "hi" }],
      preferStream: true,
      onStream: (chunk) => streamChunks.push(chunk),
    });

    expect(result).toEqual({ content: "结论", reasoningContent: "先分析" });
    expect(streamChunks).toEqual([
      { content: "", reasoningContent: "先分析", phase: "thinking" },
      { content: "结论", reasoningContent: "先分析", phase: "streaming" },
    ]);
  });

  it("removes think tags from non-streaming visible content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "<think>先推理</think>\n\n正式观点" } }],
      }),
    });

    const result = await callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test",
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result).toEqual({ content: "正式观点", reasoningContent: "先推理" });
  });

  it("falls back to non-streaming when streaming is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ error: { message: "stream unsupported" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ choices: [{ message: { content: "fallback ok" } }] }),
      });

    const result = await callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      model: "local-model",
      messages: [{ role: "user", content: "hi" }],
      preferStream: true,
    });

    expect(result.content).toBe("fallback ok");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).stream).toBe(false);
  });

  it("does not hide server failures by retrying without streaming", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: { message: "server failed" } }),
    });

    await expect(callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      model: "local-model",
      messages: [{ role: "user", content: "hi" }],
      preferStream: true,
    })).rejects.toThrow("Model request failed with status 500");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts model requests when caller signal is aborted", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      (init as RequestInit).signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    }));

    const promise = callChatCompletion({
      fetchImpl: fetchMock as unknown as typeof fetch,
      baseUrl: "http://localhost:11434/v1",
      apiKey: null,
      model: "local-model",
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toThrow("用户已停止讨论");
  });
});
