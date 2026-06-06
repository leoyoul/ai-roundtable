import { describe, expect, it } from "vitest";
import { splitThinkingContent } from "@/lib/ai/thinking";

describe("thinking content utilities", () => {
  it("separates think tags from visible content", () => {
    const result = splitThinkingContent("<think>先分析风险</think>\n\n## 结论\n\n先做试点。");

    expect(result.content).toBe("## 结论\n\n先做试点。");
    expect(result.reasoningContent).toBe("先分析风险");
  });

  it("handles streaming open thinking tags", () => {
    const result = splitThinkingContent("<think>第一步先判断");

    expect(result.content).toBe("");
    expect(result.reasoningContent).toBe("第一步先判断");
    expect(result.hasOpenThinkingBlock).toBe(true);
  });
});
