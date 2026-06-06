import { describe, expect, it } from "vitest";
import { buildSpeakerMessages } from "@/lib/meeting/context-builder";
import { parseConvergenceResult } from "@/lib/meeting/convergence-judge";
import { generateMarkdownReport } from "@/lib/meeting/report-generator";
import { deriveMeetingViewState, getMessageTypeLabel } from "@/lib/meeting/meeting-view-state";
import { canRunConvergenceJudge, runOneRoundWithModels } from "@/lib/meeting/orchestrator";

describe("meeting services", () => {
  it("includes user interventions in speaker context", () => {
    const messages = buildSpeakerMessages({
      topic: "如何降低成本",
      speakerName: "GPT",
      identityPrompt: "你是财务负责人，优先关注成本和 ROI",
      round: 2,
      recentMessages: [
        { speakerName: "用户", type: "user_intervention", content: "重点讨论本地部署" },
        { speakerName: "Qwen", type: "ai_message", content: "可以用本地模型" },
      ],
      latestSummary: "已有共识：先做 MVP",
    });

    const fullText = messages.map((item) => item.content).join("\n");
    expect(fullText).toContain("重点讨论本地部署");
    expect(fullText).toContain("如何降低成本");
    expect(fullText).toContain("你是财务负责人");
  });

  it("parses convergence JSON", () => {
    const result = parseConvergenceResult(JSON.stringify({
      consensus_points: ["先做本地版"],
      disagreement_points: [],
      open_questions: ["是否需要 PDF"],
      convergence_score: 82,
      should_end: true,
      reason: "主要问题已收敛",
    }));

    expect(result.convergenceScore).toBe(82);
    expect(result.shouldEnd).toBe(true);
  });

  it("generates markdown report with user interventions", () => {
    const markdown = generateMarkdownReport({
      topic: "测试会议",
      models: ["GPT", "Qwen"],
      timeline: [
        { speakerName: "用户", content: "请关注成本" },
        { speakerName: "GPT", content: "建议先做 MVP" },
      ],
      consensus: ["先做本地版"],
      disagreements: [],
      conclusion: "可以执行",
      actionItems: ["搭建项目"],
    });

    expect(markdown).toContain("## 用户引导");
    expect(markdown).toContain("请关注成本");
    expect(markdown).toContain("可以执行");
  });

  it("runs models in participant order and continues after one model fails", async () => {
    const calls: string[] = [];
    const result = await runOneRoundWithModels({
      topic: "测试主题",
      round: 1,
      participants: [
        { modelId: "a", displayName: "A", baseUrl: "http://a.test/v1", model: "a-model", apiKey: null, identityPrompt: "技术视角" },
        { modelId: "b", displayName: "B", baseUrl: "http://b.test/v1", model: "b-model", apiKey: null, identityPrompt: "业务视角" },
      ],
      recentMessages: [{ speakerName: "用户", type: "user_intervention", content: "请关注成本" }],
      latestSummary: null,
      callModel: async ({ displayName }) => {
        calls.push(displayName);
        if (displayName === "A") throw new Error("A failed");
        return `${displayName} 回复`;
      },
    });

    expect(calls).toEqual(["A", "B"]);
    expect(result.messages).toEqual([
      { type: "error", speakerName: "A", modelId: "a", content: "A failed" },
      { type: "ai_message", speakerName: "B", modelId: "b", content: "B 回复" },
    ]);
  });

  it("does not allow convergence before three rounds and every model has spoken", () => {
    expect(canRunConvergenceJudge({
      nextRound: 1,
      participantModelIds: ["a", "b"],
      messages: [
        { type: "ai_message", modelId: "a", content: "A" },
        { type: "ai_message", modelId: "b", content: "B" },
      ],
    })).toBe(false);

    expect(canRunConvergenceJudge({
      nextRound: 3,
      participantModelIds: ["a", "b"],
      messages: [
        { type: "ai_message", modelId: "a", content: "A" },
        { type: "error", modelId: "b", content: "failed" },
      ],
    })).toBe(false);

    expect(canRunConvergenceJudge({
      nextRound: 3,
      participantModelIds: ["a", "b"],
      messages: [
        { type: "ai_message", modelId: "a", content: "A" },
        { type: "ai_message", modelId: "b", content: "B" },
      ],
    })).toBe(true);
  });

  it("derives meeting phase, permissions, and active speaker", () => {
    const meeting = {
      id: "m",
      topic: "测试",
      status: "running" as const,
      currentRound: 2,
      convergenceScore: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      startedAt: null,
      endedAt: null,
    };
    const participants = [
      { id: "p1", meetingId: "m", modelId: "a", sortOrder: 0, displayNameSnapshot: "A", baseUrlSnapshot: "http://a", modelNameSnapshot: "a", identityPromptSnapshot: "", createdAt: meeting.createdAt },
      { id: "p2", meetingId: "m", modelId: "b", sortOrder: 1, displayNameSnapshot: "B", baseUrlSnapshot: "http://b", modelNameSnapshot: "b", identityPromptSnapshot: "", createdAt: meeting.createdAt },
    ];
    const state = deriveMeetingViewState({
      meeting,
      participants,
      hasFinalReport: false,
      messages: [
        { id: "1", meetingId: "m", round: 2, type: "ai_message", speakerName: "A", modelId: "a", content: "A", metadata: {}, createdAt: meeting.createdAt },
        { id: "2", meetingId: "m", round: 2, type: "pending", speakerName: "B", modelId: "b", content: "等待", metadata: {}, createdAt: meeting.createdAt },
      ],
    });

    expect(state.phase).toBe("discussing");
    expect(state.phaseLabel).toBe("讨论中");
    expect(state.activeSpeakerName).toBe("B");
    expect(state.roundProgress).toEqual({ completed: 1, total: 2 });
    expect(state.canStop).toBe(true);
    expect(state.canFinalize).toBe(true);
  });

  it("maps message types to Chinese labels", () => {
    expect(getMessageTypeLabel("ai_message")).toBe("发言");
    expect(getMessageTypeLabel("user_intervention")).toBe("用户插话");
    expect(getMessageTypeLabel("pending")).toBe("等待中");
  });
});
