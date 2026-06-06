import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { startFakeOpenAiServer } from "../fixtures/fake-openai-server";

test.beforeEach(async ({ page }) => {
  await page.request.post("/api/test/reset");
  await page.goto("/models");
});

test("user can run a two-model meeting, intervene, finalize, and export sanitized reports", async ({ page }) => {
  const fake = await startFakeOpenAiServer((body) => {
    const prompt = JSON.stringify(body.messages);
    if (prompt.includes("输出 JSON 字段")) {
      return {
        status: 200,
        content: JSON.stringify({
          consensus: ["先做本地版"],
          disagreements: [],
          conclusion: "可以执行",
          action_items: ["搭建项目"],
        }),
      };
    }
    if (prompt.includes("请判断会议是否收敛")) {
      return {
        status: 200,
        content: JSON.stringify({
          consensus_points: ["先做本地版"],
          disagreement_points: [],
          open_questions: [],
          convergence_score: 85,
          should_end: true,
          reason: "观点已接近",
        }),
      };
    }
    return { status: 200, content: `## 回复\n\n- 模型：${body.model}`, stream: body.stream === true };
  });
  try {
    await page.getByLabel("名称").fill("模型 A");
    await page.getByLabel("Base URL").fill(fake.url);
    await page.getByLabel("API Key").fill("sk-secret-a");
    await page.getByLabel("模型名").fill("fake-a");
    await page.getByRole("button", { name: "保存模型" }).click();
    await expect(page.getByText("模型 A")).toBeVisible();

    await page.getByLabel("名称").fill("模型 B");
    await page.getByLabel("Base URL").fill(fake.url);
    await page.getByLabel("API Key").fill("sk-secret-b");
    await page.getByLabel("模型名").fill("fake-b");
    await page.getByRole("button", { name: "保存模型" }).click();
    await expect(page.getByText("模型 B")).toBeVisible();
    await expect(page.getByText("sk-secret")).toHaveCount(0);

    await page.goto("/meetings/new");
    await page.getByLabel("会议主题").fill("如何做 AI 圆桌会议");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByText("模型 A").click();
    await page.getByText("模型 B").click();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "创建会议" }).click();

    await expect(page.getByText("如何做 AI 圆桌会议")).toBeVisible();
    await page.getByLabel("插入下一轮讨论").fill("请重点讨论本地保存会议纪要");
    await page.getByRole("button", { name: "发送插话" }).click();
    await expect(page.getByText("已记录，下一次发言生效")).toBeVisible();
    await page.getByRole("button", { name: "开始自动讨论" }).click();
    await expect(page.getByRole("heading", { name: "回复" }).first()).toBeVisible();
    await expect(page.getByText("模型：fake-a").first()).toBeVisible();
    await expect(page.getByText("模型：fake-b").first()).toBeVisible();
    await expect.poll(() => JSON.stringify(fake.requests)).toContain("请重点讨论本地保存会议纪要");
    await expect(page.getByText("第 3 轮：85")).toBeVisible();

    await page.getByRole("button", { name: "生成纪要" }).click();
    await expect(page.getByRole("heading", { name: "会议纪要" })).toBeVisible();

    const markdownDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "导出 Markdown" }).click();
    const markdownPath = await (await markdownDownload).path();
    expect(markdownPath).toBeTruthy();
    const markdownText = await fs.promises.readFile(markdownPath!, "utf8");
    expect(markdownText).not.toContain("sk-secret");

    const jsonDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "导出 JSON" }).click();
    const jsonPath = await (await jsonDownload).path();
    expect(jsonPath).toBeTruthy();
    const jsonText = await fs.promises.readFile(jsonPath!, "utf8");
    expect(jsonText).not.toContain("sk-secret");
  } finally {
    await fake.close();
  }
});

test("one model failure does not stop the other model", async ({ page }) => {
  let failedA = false;
  const fake = await startFakeOpenAiServer((body) => {
    const prompt = JSON.stringify(body.messages);
    if (prompt.includes("请判断会议是否收敛")) {
      return {
        status: 200,
        content: JSON.stringify({
          consensus_points: ["仍可继续"],
          disagreement_points: [],
          open_questions: [],
          convergence_score: 86,
          should_end: true,
          reason: "已恢复并收敛",
        }),
      };
    }
    if (body.model === "fake-a" && !failedA) {
      failedA = true;
      return { status: 500, content: "failed" };
    }
    return { status: 200, content: "模型 B 正常回复" };
  });
  try {
    await page.getByLabel("名称").fill("失败模型 A");
    await page.getByLabel("Base URL").fill(fake.url);
    await page.getByLabel("模型名").fill("fake-a");
    await page.getByRole("button", { name: "保存模型" }).click();
    await page.getByLabel("名称").fill("模型 B");
    await page.getByLabel("Base URL").fill(fake.url);
    await page.getByLabel("模型名").fill("fake-b");
    await page.getByRole("button", { name: "保存模型" }).click();

    await page.goto("/meetings/new");
    await page.getByLabel("会议主题").fill("失败不中断测试");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByText("失败模型 A").click();
    await page.getByText("模型 B").click();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "创建会议" }).click();
    await page.getByRole("button", { name: "开始自动讨论" }).click();

    await expect(page.getByText("Model request failed with status 500")).toBeVisible();
    await expect(page.getByText("模型 B 正常回复").first()).toBeVisible();
    await expect(page.getByText("第 3 轮：86")).toBeVisible();
    await expect(page.getByText("已收敛").first()).toBeVisible();
    await page.getByLabel("插入下一轮讨论").fill("继续补充一个问题");
    await expect(page.getByRole("button", { name: "发送插话" })).toBeEnabled();
  } finally {
    await fake.close();
  }
});

test("user can stop an automatic meeting run", async ({ page }) => {
  let releaseResponse!: () => void;
  const fake = await startFakeOpenAiServer((_body) => ({
    status: 200,
    content: "这条回复不会立即返回",
    delayUntil: new Promise<void>((resolve) => {
      releaseResponse = resolve;
    }),
  }));
  try {
    await page.getByLabel("名称").fill("慢模型");
    await page.getByLabel("Base URL").fill(fake.url);
    await page.getByLabel("模型名").fill("slow-model");
    await page.getByRole("button", { name: "保存模型" }).click();

    await page.goto("/meetings/new");
    await page.getByLabel("会议主题").fill("停止讨论测试");
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByText("慢模型").click();
    await page.getByRole("button", { name: "下一步" }).click();
    await page.getByRole("button", { name: "创建会议" }).click();

    void page.getByRole("button", { name: "开始自动讨论" }).click();
    await expect(page.getByRole("button", { name: "停止讨论" })).toBeVisible();
    await page.getByRole("button", { name: "停止讨论" }).click();
    releaseResponse();

    await expect(page.getByText("已停止", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("已停止讨论。", { exact: true })).toBeVisible();
    await expect(page.getByText("已收敛", { exact: true })).toHaveCount(0);
  } finally {
    releaseResponse?.();
    await fake.close();
  }
});
