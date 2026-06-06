import type { Meeting, MeetingMessage, MeetingParticipant, MeetingPhase, MeetingViewState, MessageType } from "@/lib/types";

const messageTypeLabels: Record<MessageType, string> = {
  pending: "等待中",
  ai_message: "发言",
  user_intervention: "用户插话",
  system_summary: "系统记录",
  error: "错误",
};

const phaseLabels: Record<MeetingPhase, string> = {
  draft: "待开始",
  discussing: "讨论中",
  judging: "判断收敛",
  stopped: "已停止",
  converged: "已收敛",
  ended: "已结束",
  failed: "失败",
};

export function getMessageTypeLabel(type: MessageType): string {
  return messageTypeLabels[type];
}

export function deriveMeetingViewState(input: {
  meeting: Meeting;
  participants: MeetingParticipant[];
  messages: MeetingMessage[];
  hasFinalReport: boolean;
}): MeetingViewState {
  const pending = input.messages.find((message) => message.type === "pending");
  const phase = derivePhase(input.meeting, Boolean(pending), input.hasFinalReport);
  const activeRound = pending?.round ?? Math.max(input.meeting.currentRound, 1);
  const roundAiMessages = input.messages.filter((message) => message.round === activeRound && message.type === "ai_message");
  const completed = Math.min(roundAiMessages.length, input.participants.length);

  return {
    phase,
    phaseLabel: phaseLabels[phase],
    activeSpeakerName: pending?.speakerName ?? null,
    roundProgress: {
      completed,
      total: input.participants.length,
    },
    canStart: input.meeting.status === "draft",
    canStop: input.meeting.status === "running",
    canContinue: input.meeting.status === "running" || input.meeting.status === "stopped" || input.meeting.status === "converged",
    canFinalize: input.meeting.status === "running" || input.meeting.status === "stopped" || input.meeting.status === "converged" || input.hasFinalReport,
  };
}

function derivePhase(meeting: Meeting, hasPendingMessage: boolean, hasFinalReport: boolean): MeetingPhase {
  if (meeting.status === "draft") return "draft";
  if (meeting.status === "stopped") return "stopped";
  if (meeting.status === "failed") return "failed";
  if (meeting.status === "ended" || hasFinalReport) return "ended";
  if (meeting.status === "converged") return "converged";
  if (hasPendingMessage) return "discussing";
  return "judging";
}
