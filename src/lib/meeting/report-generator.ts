interface ReportInput {
  topic: string;
  models: string[];
  timeline: Array<{ speakerName: string; content: string }>;
  consensus: string[];
  disagreements: string[];
  conclusion: string;
  actionItems: string[];
}

export function generateMarkdownReport(input: ReportInput): string {
  const userInterventions = input.timeline.filter((item) => item.speakerName === "用户");

  return [
    "# 会议纪要",
    "",
    "## 主题",
    input.topic,
    "",
    "## 参会模型",
    ...input.models.map((model) => `- ${model}`),
    "",
    "## 会议过程",
    ...input.timeline.map((item) => `- **${item.speakerName}**：${item.content}`),
    "",
    "## 用户引导",
    ...(userInterventions.length ? userInterventions.map((item) => `- ${item.content}`) : ["无"]),
    "",
    "## 共识",
    ...(input.consensus.length ? input.consensus.map((item) => `- ${item}`) : ["无"]),
    "",
    "## 分歧",
    ...(input.disagreements.length ? input.disagreements.map((item) => `- ${item}`) : ["无"]),
    "",
    "## 结论",
    input.conclusion,
    "",
    "## 建议行动项",
    ...(input.actionItems.length ? input.actionItems.map((item) => `- ${item}`) : ["无"]),
    "",
  ].join("\n");
}

export function generateJsonReport(input: ReportInput): string {
  return JSON.stringify({
    topic: input.topic,
    models: input.models,
    timeline: input.timeline,
    user_interventions: input.timeline.filter((item) => item.speakerName === "用户"),
    consensus: input.consensus,
    disagreements: input.disagreements,
    conclusion: input.conclusion,
    action_items: input.actionItems,
  }, null, 2);
}
