import type { ChatMessage } from "@/lib/ai/model-client";

export interface RecentMessage {
  speakerName: string;
  type: string;
  content: string;
}

export function buildSpeakerMessages(input: {
  topic: string;
  speakerName: string;
  identityPrompt: string;
  round: number;
  recentMessages: RecentMessage[];
  latestSummary: string | null;
}): ChatMessage[] {
  const timeline = input.recentMessages
    .map((message) => `${message.speakerName}（${message.type}）：${message.content}`)
    .join("\n");

  return [
    {
      role: "system",
      content: [
        "你正在参加一个 AI 圆桌会议。请直接给出你的观点，避免客套，回应用户引导和其他 AI 的关键观点。",
        input.identityPrompt ? `你的参会身份设定：\n${input.identityPrompt}` : "",
      ].filter(Boolean).join("\n\n"),
    },
    {
      role: "user",
      content: [
        `会议主题：${input.topic}`,
        `当前轮次：第 ${input.round} 轮`,
        `当前发言模型：${input.speakerName}`,
        input.latestSummary ? `最新收敛摘要：${input.latestSummary}` : "",
        "会议时间线：",
        timeline || "暂无",
      ].filter(Boolean).join("\n"),
    },
  ];
}

export function buildJudgeMessages(input: {
  topic: string;
  timelineText: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: "你是会议主持人。只输出 JSON，不要输出 Markdown。",
    },
    {
      role: "user",
      content: `请判断会议是否收敛。主题：${input.topic}\n会议记录：\n${input.timelineText}\n输出字段：consensus_points, disagreement_points, open_questions, convergence_score, should_end, reason。`,
    },
  ];
}

export function buildFinalReportMessages(input: {
  topic: string;
  timelineText: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: "你是会议主持人。只输出 JSON，不要输出 Markdown。",
    },
    {
      role: "user",
      content: [
        `请基于完整会议记录生成最终纪要结构。主题：${input.topic}`,
        "会议记录：",
        input.timelineText,
        '输出 JSON 字段：{"consensus":["..."],"disagreements":["..."],"conclusion":"...","action_items":["..."]}',
      ].join("\n"),
    },
  ];
}
