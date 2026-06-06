import type Database from "better-sqlite3";
import { callChatCompletion } from "@/lib/ai/model-client";
import { splitThinkingContent } from "@/lib/ai/thinking";
import { getModelForCall, type ModelForCall } from "@/lib/db/repositories/models";
import { getMeetingDetail, updateMeetingProgress, updateMeetingStatus } from "@/lib/db/repositories/meetings";
import { addMessage, listMessages, updateMessage } from "@/lib/db/repositories/messages";
import { listRoundReports, saveFinalReport, saveRoundReport } from "@/lib/db/repositories/reports";
import type { MeetingMessage, MessageType } from "@/lib/types";
import { buildFinalReportMessages, buildJudgeMessages, buildSpeakerMessages, type RecentMessage } from "./context-builder";
import { parseConvergenceResult, parseFinalReportResult } from "./convergence-judge";
import { generateJsonReport, generateMarkdownReport } from "./report-generator";

const maxRounds = 20;
const minRoundsBeforeConvergence = 3;
const activeMeetingControllers = new Map<string, AbortController>();

interface RoundParticipant {
  modelId: string | null;
  displayName: string;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  identityPrompt: string;
}

interface RoundInput {
  topic: string;
  round: number;
  participants: RoundParticipant[];
  recentMessages: RecentMessage[];
  latestSummary: string | null;
  callModel: (input: RoundParticipant & { messages: ReturnType<typeof buildSpeakerMessages> }) => Promise<string>;
}

export async function runOneRoundWithModels(input: RoundInput): Promise<{
  messages: Array<{ type: MessageType; speakerName: string; modelId: string | null; content: string }>;
}> {
  const messages = [];
  for (const participant of input.participants) {
    try {
      const content = await input.callModel({
        ...participant,
        messages: buildSpeakerMessages({
          topic: input.topic,
          speakerName: participant.displayName,
          identityPrompt: participant.identityPrompt,
          round: input.round,
          recentMessages: input.recentMessages,
          latestSummary: input.latestSummary,
        }),
      });
      messages.push({
        type: "ai_message" as const,
        speakerName: participant.displayName,
        modelId: participant.modelId,
        content,
      });
    } catch (error) {
      messages.push({
        type: "error" as const,
        speakerName: participant.displayName,
        modelId: participant.modelId,
        content: error instanceof Error ? error.message : "Model call failed",
      });
    }
  }
  return { messages };
}

export function recordUserIntervention(db: Database.Database, meetingId: string, content: string) {
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) {
    throw new Error("Meeting not found");
  }

  return addMessage(db, {
    meetingId,
    round: detail.meeting.currentRound,
    type: "user_intervention",
    speakerName: "用户",
    modelId: null,
    content,
    metadata: { effectiveFrom: "next_model_call" },
  });
}

export async function startMeeting(db: Database.Database, meetingId: string) {
  updateMeetingStatus(db, meetingId, "running");
  return runMeetingUntilStop(db, meetingId);
}

export async function continueMeeting(db: Database.Database, meetingId: string) {
  updateMeetingStatus(db, meetingId, "running");
  return runMeetingUntilStop(db, meetingId);
}

export function stopMeeting(db: Database.Database, meetingId: string) {
  activeMeetingControllers.get(meetingId)?.abort();
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) {
    throw new Error("Meeting not found");
  }

  if (detail.meeting.status === "running") {
    updateMeetingStatus(db, meetingId, "stopped");
    addMessage(db, {
      meetingId,
      round: detail.meeting.currentRound,
      type: "system_summary",
      speakerName: "系统",
      modelId: null,
      content: "用户已停止讨论。",
      metadata: { reason: "user_stopped" },
    });
  }

  return getMeetingDetail(db, meetingId);
}

export async function finalizeMeeting(db: Database.Database, meetingId: string): Promise<
  | { ok: true; finalReport: { markdown: string; json: string } }
  | { ok: false; retryable: true; error: string }
> {
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) {
    throw new Error("Meeting not found");
  }

  const messages = listMessages(db, meetingId);
  const timelineText = timelineToText(messages);
  const judge = await callWithHostFallback(db, meetingId, null, async (model) => {
    const result = await callChatCompletion({
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      model: model.model,
      messages: buildFinalReportMessages({ topic: detail.meeting.topic, timelineText }),
    });
    return parseFinalReportResult(result.content);
  });

  if (!judge.ok) {
    return { ok: false, retryable: true, error: judge.error };
  }

  const models = detail.participants.map((participant) => participant.displayNameSnapshot);
  const timeline = messages.map((message) => ({ speakerName: message.speakerName, content: message.content }));
  const reportInput = {
    topic: detail.meeting.topic,
    models,
    timeline,
    consensus: judge.value.consensus,
    disagreements: judge.value.disagreements,
    conclusion: judge.value.conclusion,
    actionItems: judge.value.actionItems,
  };
  const markdown = generateMarkdownReport(reportInput);
  const json = generateJsonReport(reportInput);
  saveFinalReport(db, { meetingId, markdown, json });
  updateMeetingStatus(db, meetingId, "ended");
  return { ok: true, finalReport: { markdown, json } };
}

async function runMeetingRound(db: Database.Database, meetingId: string, signal: AbortSignal) {
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) {
    throw new Error("Meeting not found");
  }
  if (detail.meeting.status !== "running" || signal.aborted) {
    return detail;
  }

  const nextRound = detail.meeting.currentRound + 1;
  const existingMessages = listMessages(db, meetingId);
  const callableParticipants = detail.participants.map((participant) => {
    const model = participant.modelId ? getModelForCall(db, participant.modelId) : null;
    return {
      participant,
      model,
    };
  });

  const roundMessages = [];
  for (const { participant, model } of callableParticipants) {
    if (signal.aborted || isMeetingStopped(db, meetingId)) {
      updateMeetingProgress(db, meetingId, {
        currentRound: Math.max(detail.meeting.currentRound, nextRound - 1),
        convergenceScore: detail.meeting.convergenceScore,
        status: "stopped",
      });
      return getMeetingDetail(db, meetingId);
    }

    const pending = addMessage(db, {
      meetingId,
      round: nextRound,
      type: "pending",
      speakerName: participant.displayNameSnapshot,
      modelId: participant.modelId,
      content: "正在思考，等待模型返回...",
      metadata: { phase: "thinking" },
    });

    try {
      if (!model || model.keyUnavailable || !model.enabled) {
        throw new Error("Model is unavailable");
      }
      const messages = buildSpeakerMessages({
        topic: detail.meeting.topic,
        speakerName: participant.displayNameSnapshot,
        identityPrompt: participant.identityPromptSnapshot,
        round: nextRound,
        recentMessages: listMessages(db, meetingId).map(toRecentMessage),
        latestSummary: latestSummary(db, meetingId),
      });
      const result = await callChatCompletion({
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        model: model.model,
        messages,
        signal,
        preferStream: true,
        onStream: (chunk) => {
          updateMessage(db, pending.id, {
            type: "pending",
            content: chunk.content || "正在思考，等待模型返回...",
            metadata: {
              phase: chunk.phase,
              reasoningContent: chunk.reasoningContent,
            },
          });
        },
      });
      updateMessage(db, pending.id, {
        type: "ai_message",
        content: result.content,
        metadata: result.reasoningContent ? { reasoningContent: result.reasoningContent } : {},
      });
      roundMessages.push({ type: "ai_message" as const, modelId: participant.modelId });
    } catch (error) {
      if (signal.aborted || isMeetingStopped(db, meetingId)) {
        updateMessage(db, pending.id, {
          type: "system_summary",
          content: "用户已停止讨论，已取消本次发言。",
          metadata: { reason: "user_stopped" },
        });
        updateMeetingProgress(db, meetingId, {
          currentRound: nextRound,
          convergenceScore: detail.meeting.convergenceScore,
          status: "stopped",
        });
        return getMeetingDetail(db, meetingId);
      }
      updateMessage(db, pending.id, {
        type: "error",
        content: error instanceof Error ? error.message : "Model call failed",
        metadata: {},
      });
      roundMessages.push({ type: "error" as const, modelId: participant.modelId });
    }
  }

  if (signal.aborted || isMeetingStopped(db, meetingId)) {
    updateMeetingProgress(db, meetingId, {
      currentRound: nextRound,
      convergenceScore: detail.meeting.convergenceScore,
      status: "stopped",
    });
    return getMeetingDetail(db, meetingId);
  }

  const allMessages = listMessages(db, meetingId);
  const hasEnoughDiscussion = canRunConvergenceJudge({
    nextRound,
    participantModelIds: detail.participants.map((item) => item.modelId),
    messages: allMessages,
  });
  if (!hasEnoughDiscussion) {
    updateMeetingProgress(db, meetingId, {
      currentRound: nextRound,
      convergenceScore: null,
      status: roundMessages.every((message) => message.type === "error") ? "failed" : "running",
    });
    return getMeetingDetail(db, meetingId);
  }

  const convergence = await callWithHostFallback(db, meetingId, signal, async (model) => {
    const result = await callChatCompletion({
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      model: model.model,
      messages: buildJudgeMessages({
        topic: detail.meeting.topic,
        timelineText: timelineToText(allMessages),
      }),
      signal,
    });
    return parseConvergenceResult(result.content);
  });

  if (signal.aborted || isMeetingStopped(db, meetingId)) {
    updateMeetingProgress(db, meetingId, {
      currentRound: nextRound,
      convergenceScore: detail.meeting.convergenceScore,
      status: "stopped",
    });
    return getMeetingDetail(db, meetingId);
  }

  if (!convergence.ok) {
    updateMeetingProgress(db, meetingId, {
      currentRound: nextRound,
      convergenceScore: detail.meeting.convergenceScore,
      status: roundMessages.every((message) => message.type === "error") ? "failed" : "running",
    });
    return getMeetingDetail(db, meetingId);
  }

  saveRoundReport(db, {
    meetingId,
    round: nextRound,
    consensusPoints: convergence.value.consensusPoints,
    disagreementPoints: convergence.value.disagreementPoints,
    openQuestions: convergence.value.openQuestions,
    convergenceScore: convergence.value.convergenceScore,
    shouldEnd: convergence.value.shouldEnd,
    reason: convergence.value.reason,
  });

  const shouldConverge = convergence.value.convergenceScore >= 80 || convergence.value.shouldEnd || nextRound >= maxRounds;
  updateMeetingProgress(db, meetingId, {
    currentRound: nextRound,
    convergenceScore: convergence.value.convergenceScore,
    status: shouldConverge ? "converged" : "running",
  });
  return getMeetingDetail(db, meetingId);
}

async function runMeetingUntilStop(db: Database.Database, meetingId: string) {
  activeMeetingControllers.get(meetingId)?.abort();
  const controller = new AbortController();
  activeMeetingControllers.set(meetingId, controller);

  let latest = getMeetingDetail(db, meetingId);
  try {
    while (!controller.signal.aborted && latest?.meeting.status === "running" && latest.meeting.currentRound < maxRounds) {
      latest = await runMeetingRound(db, meetingId, controller.signal);
    }

    latest = getMeetingDetail(db, meetingId);
    if (latest?.meeting.status === "running" && latest.meeting.currentRound >= maxRounds) {
      updateMeetingProgress(db, meetingId, {
        currentRound: latest.meeting.currentRound,
        convergenceScore: latest.meeting.convergenceScore,
        status: "converged",
      });
      addMessage(db, {
        meetingId,
        round: latest.meeting.currentRound,
        type: "system_summary",
        speakerName: "系统",
        modelId: null,
        content: `已达到最高 ${maxRounds} 轮，自动停止讨论。`,
        metadata: { reason: "max_rounds", maxRounds },
      });
      latest = getMeetingDetail(db, meetingId);
    }
  } finally {
    if (activeMeetingControllers.get(meetingId) === controller) {
      activeMeetingControllers.delete(meetingId);
    }
  }

  return latest;
}

async function callWithHostFallback<T>(
  db: Database.Database,
  meetingId: string,
  signal: AbortSignal | null,
  callback: (model: ModelForCall) => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  const detail = getMeetingDetail(db, meetingId);
  if (!detail) {
    return { ok: false, error: "Meeting not found" };
  }

  const models = detail.participants
    .map((participant) => (participant.modelId ? getModelForCall(db, participant.modelId) : null))
    .filter((model): model is ModelForCall => Boolean(model && model.enabled && !model.keyUnavailable));

  let lastError = "No callable host model";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (signal?.aborted || isMeetingStopped(db, meetingId)) {
        return { ok: false, error: "用户已停止讨论" };
      }
      try {
        return { ok: true, value: await callback(model) };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Host model failed";
        if (signal?.aborted || isMeetingStopped(db, meetingId)) {
          return { ok: false, error: lastError };
        }
      }
    }
  }
  return { ok: false, error: lastError };
}

function isMeetingStopped(db: Database.Database, meetingId: string): boolean {
  return getMeetingDetail(db, meetingId)?.meeting.status === "stopped";
}

function latestSummary(db: Database.Database, meetingId: string): string | null {
  const report = listRoundReports(db, meetingId).at(-1);
  return report ? [...report.consensusPoints, ...report.disagreementPoints, report.reason].filter(Boolean).join("\n") : null;
}

function toRecentMessage(message: MeetingMessage): RecentMessage {
  return {
    speakerName: message.speakerName,
    type: message.type,
    content: visibleMessageContent(message),
  };
}

function timelineToText(messages: MeetingMessage[]): string {
  return messages.map((message) => `${message.speakerName}：${visibleMessageContent(message)}`).join("\n");
}

function visibleMessageContent(message: MeetingMessage): string {
  const metadataContent = typeof message.metadata.displayContent === "string" ? message.metadata.displayContent : "";
  if (metadataContent) return metadataContent;
  return splitThinkingContent(message.content).content || message.content;
}

export function canRunConvergenceJudge(input: {
  nextRound: number;
  participantModelIds: Array<string | null>;
  messages: Array<Pick<MeetingMessage, "type" | "modelId" | "content">>;
}): boolean {
  if (input.nextRound < minRoundsBeforeConvergence) {
    return false;
  }

  return input.participantModelIds.every((modelId) => {
    if (!modelId) {
      return false;
    }
    return input.messages.some((message) => message.type === "ai_message" && message.modelId === modelId && message.content.trim().length > 0);
  });
}
