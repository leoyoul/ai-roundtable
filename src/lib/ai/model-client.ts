import { joinReasoningContent, splitThinkingContent } from "@/lib/ai/thinking";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  content: string;
  reasoningContent?: string;
}

export interface ChatCompletionStreamChunk {
  content: string;
  reasoningContent: string;
  phase: "thinking" | "streaming";
}

interface CallChatCompletionInput {
  fetchImpl?: typeof fetch;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  messages: ChatMessage[];
  timeoutMs?: number;
  signal?: AbortSignal;
  preferStream?: boolean;
  onToken?: (content: string) => void;
  onStream?: (chunk: ChatCompletionStreamChunk) => void;
}

export async function callChatCompletion(input: CallChatCompletionInput): Promise<ChatCompletionResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 180_000);
  const abortFromInputSignal = () => controller.abort(input.signal?.reason);

  if (input.signal?.aborted) {
    controller.abort(input.signal.reason);
  } else {
    input.signal?.addEventListener("abort", abortFromInputSignal, { once: true });
  }

  try {
    if (input.preferStream) {
      try {
        const streamResponse = await requestChatCompletion(fetchImpl, input, controller.signal, true);
        if (!streamResponse.ok) {
          if (canRetryWithoutStream(streamResponse.status)) {
            return parseJsonResponse(await requestChatCompletion(fetchImpl, input, controller.signal, false));
          }
          return parseJsonResponse(streamResponse);
        }
        const contentType = streamResponse.headers?.get("content-type") ?? "";
        if (streamResponse.body && contentType.includes("text/event-stream")) {
          const streamed = await readOpenAiStream(streamResponse, input.onToken, input.onStream);
          if (streamed.content.trim().length > 0) {
            return streamed;
          }
          return parseJsonResponse(await requestChatCompletion(fetchImpl, input, controller.signal, false));
        }
        return parseJsonResponse(streamResponse);
      } catch (error) {
        if (isAbortError(error)) {
          if (input.signal?.aborted) {
            throw new Error("用户已停止讨论");
          }
          throw new Error("模型响应超时，请稍后继续一轮或调高本地模型超时");
        }
        return parseJsonResponse(await requestChatCompletion(fetchImpl, input, controller.signal, false));
      }
    }

    try {
      return parseJsonResponse(await requestChatCompletion(fetchImpl, input, controller.signal, false));
    } catch (error) {
      if (isAbortError(error)) {
        if (input.signal?.aborted) {
          throw new Error("用户已停止讨论");
        }
        throw new Error("模型响应超时，请稍后继续一轮或调高本地模型超时");
      }
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromInputSignal);
  }
}

async function requestChatCompletion(fetchImpl: typeof fetch, input: CallChatCompletionInput, signal: AbortSignal, stream: boolean): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`;
  }

  return fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0.3,
      stream,
    }),
  });
}

async function parseJsonResponse(response: Response): Promise<ChatCompletionResult> {
  if (!response.ok) {
    throw new Error(`Model request failed with status ${response.status}`);
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Model response did not include content");
  }

  const explicitReasoning = extractReasoningValue(message);
  const split = splitThinkingContent(content);
  return {
    content: split.content,
    reasoningContent: joinReasoningContent([explicitReasoning, split.reasoningContent]) || undefined,
  };
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
}

function canRetryWithoutStream(status: number): boolean {
  return status === 400 || status === 415 || status === 422;
}

async function readOpenAiStream(response: Response, onToken?: (content: string) => void, onStream?: (chunk: ChatCompletionStreamChunk) => void): Promise<ChatCompletionResult> {
  const reader = response.body?.getReader();
  if (!reader) return { content: "" };

  const decoder = new TextDecoder();
  let buffer = "";
  let rawContent = "";
  let explicitReasoning = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta;
        const contentDelta = extractContentValue(delta);
        const reasoningDelta = extractReasoningValue(delta);
        if (contentDelta) {
          rawContent += contentDelta;
        }
        if (reasoningDelta) {
          explicitReasoning += reasoningDelta;
        }

        if (contentDelta || reasoningDelta) {
          const split = splitThinkingContent(rawContent);
          const reasoningContent = joinReasoningContent([explicitReasoning, split.reasoningContent]);
          onToken?.(split.content);
          onStream?.({
            content: split.content,
            reasoningContent,
            phase: split.content.length > 0 ? "streaming" : "thinking",
          });
        }
      } catch {
        return { content: "" };
      }
    }
  }

  const split = splitThinkingContent(rawContent);
  return {
    content: split.content,
    reasoningContent: joinReasoningContent([explicitReasoning, split.reasoningContent]) || undefined,
  };
}

function extractContentValue(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return typeof record.content === "string" ? record.content : "";
}

function extractReasoningValue(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  const candidates = [
    record.reasoning_content,
    record.reasoning,
    record.thinking,
    record.thinking_content,
    record.reasoningContent,
  ];
  return candidates.filter((item): item is string => typeof item === "string" && item.length > 0).join("");
}
