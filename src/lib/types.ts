export const meetingStatuses = ["draft", "running", "stopped", "converged", "ended", "failed"] as const;
export type MeetingStatus = (typeof meetingStatuses)[number];

export const meetingPhases = ["draft", "discussing", "judging", "stopped", "converged", "ended", "failed"] as const;
export type MeetingPhase = (typeof meetingPhases)[number];

export const messageTypes = ["pending", "ai_message", "user_intervention", "system_summary", "error"] as const;
export type MessageType = (typeof messageTypes)[number];

export interface ModelConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEncrypted: string | null;
  model: string;
  identityPrompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  topic: string;
  status: MeetingStatus;
  currentRound: number;
  convergenceScore: number | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  modelId: string | null;
  sortOrder: number;
  displayNameSnapshot: string;
  baseUrlSnapshot: string;
  modelNameSnapshot: string;
  identityPromptSnapshot: string;
  createdAt: string;
}

export interface MeetingMessage {
  id: string;
  meetingId: string;
  round: number;
  type: MessageType;
  speakerName: string;
  modelId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RoundReport {
  id: string;
  meetingId: string;
  round: number;
  consensusPoints: string[];
  disagreementPoints: string[];
  openQuestions: string[];
  convergenceScore: number;
  shouldEnd: boolean;
  reason: string;
  createdAt: string;
}

export interface FinalReport {
  id: string;
  meetingId: string;
  markdown: string;
  json: string;
  createdAt: string;
}

export interface MeetingRoundProgress {
  completed: number;
  total: number;
}

export interface MeetingViewState {
  phase: MeetingPhase;
  phaseLabel: string;
  activeSpeakerName: string | null;
  roundProgress: MeetingRoundProgress;
  canStart: boolean;
  canStop: boolean;
  canContinue: boolean;
  canFinalize: boolean;
}

export function isMeetingStatus(value: string): value is MeetingStatus {
  return meetingStatuses.includes(value as MeetingStatus);
}

export function isMessageType(value: string): value is MessageType {
  return messageTypes.includes(value as MessageType);
}
