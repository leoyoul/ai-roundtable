import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/db/schema";
import { createModel, deleteModel, getModelForCall, listModels, updateModel } from "@/lib/db/repositories/models";
import {
  createMeeting,
  getMeetingDetail,
  listMeetings,
  updateMeetingProgress,
  updateMeetingStatus,
} from "@/lib/db/repositories/meetings";
import { addMessage, listMessages } from "@/lib/db/repositories/messages";
import { getFinalReport, listRoundReports, saveFinalReport, saveRoundReport } from "@/lib/db/repositories/reports";

function memoryDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

describe("repositories", () => {
  process.env.AI_ROUNDTABLE_SECRET = "repository-test-secret";

  it("creates and lists models with masked API key only", () => {
    const db = memoryDb();
    const created = createModel(db, {
      name: "GPT",
      baseUrl: "https://api.example.com/v1",
      apiKey: "sk-test-123456",
      model: "gpt-test",
      identityPrompt: "你是 CFO",
      enabled: true,
    });

    const models = listModels(db);
    expect(models).toHaveLength(1);
    expect(models[0].name).toBe("GPT");
    expect(models[0].identityPrompt).toBe("你是 CFO");
    expect(models[0].apiKeyMasked).toBe("******");
    expect(JSON.stringify(models)).not.toContain("sk-test-123456");

    updateModel(db, created.id, {
      name: "GPT Updated",
      baseUrl: "https://api.example.com/v1",
      apiKey: null,
      model: "gpt-test-2",
      identityPrompt: "你是 CTO",
      enabled: false,
    });

    expect(listModels(db)[0].name).toBe("GPT Updated");
    expect(listModels(db)[0].identityPrompt).toBe("你是 CTO");
    expect(getModelForCall(db, created.id)?.identityPrompt).toBe("你是 CTO");
    expect(getModelForCall(db, created.id)?.apiKey).toBe("sk-test-123456");
    expect(getModelForCall(db, created.id)?.keyUnavailable).toBe(false);

    deleteModel(db, created.id);
    expect(listModels(db)).toHaveLength(0);
  });

  it("preserves participant order, snapshots, and message timeline", () => {
    const db = memoryDb();
    const first = createModel(db, {
      name: "A",
      baseUrl: "http://a.test/v1",
      apiKey: null,
      model: "a-model",
      identityPrompt: "你负责技术可行性",
      enabled: true,
    });
    const second = createModel(db, {
      name: "B",
      baseUrl: "http://b.test/v1",
      apiKey: null,
      model: "b-model",
      identityPrompt: "你负责预算和风险",
      enabled: true,
    });

    const meeting = createMeeting(db, {
      topic: "测试主题",
      modelIds: [second.id, first.id],
    });

    addMessage(db, {
      meetingId: meeting.id,
      round: 1,
      type: "user_intervention",
      speakerName: "用户",
      modelId: null,
      content: "请关注成本",
      metadata: {},
    });
    updateMeetingStatus(db, meeting.id, "running");

    const detail = getMeetingDetail(db, meeting.id);
    expect(detail?.participants.map((item) => item.displayNameSnapshot)).toEqual(["B", "A"]);
    expect(detail?.participants.map((item) => item.identityPromptSnapshot)).toEqual(["你负责预算和风险", "你负责技术可行性"]);
    expect(listMessages(db, meeting.id)[0].content).toBe("请关注成本");
    expect(detail?.meeting.status).toBe("running");

    deleteModel(db, second.id);
    const afterDelete = getMeetingDetail(db, meeting.id);
    expect(afterDelete?.participants[0].modelId).toBeNull();
    expect(afterDelete?.participants[0].displayNameSnapshot).toBe("B");
  });

  it("persists meeting lists, progress, round reports, and final reports", () => {
    const db = memoryDb();
    const model = createModel(db, {
      name: "A",
      baseUrl: "http://a.test/v1",
      apiKey: null,
      model: "a-model",
      identityPrompt: "",
      enabled: true,
    });
    const meeting = createMeeting(db, {
      topic: "测试主题",
      modelIds: [model.id],
    });

    updateMeetingProgress(db, meeting.id, {
      currentRound: 1,
      convergenceScore: 82,
      status: "converged",
    });
    saveRoundReport(db, {
      meetingId: meeting.id,
      round: 1,
      consensusPoints: ["先做本地版"],
      disagreementPoints: [],
      openQuestions: [],
      convergenceScore: 82,
      shouldEnd: true,
      reason: "已收敛",
    });
    saveFinalReport(db, {
      meetingId: meeting.id,
      markdown: "# 会议纪要",
      json: JSON.stringify({ conclusion: "可以执行" }),
    });

    expect(listMeetings(db)[0].convergenceScore).toBe(82);
    expect(listMessages(db, meeting.id)).toEqual([]);
    expect(listRoundReports(db, meeting.id)[0].reason).toBe("已收敛");
    expect(getFinalReport(db, meeting.id)?.markdown).toContain("会议纪要");
  });
});
