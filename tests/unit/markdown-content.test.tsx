import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/MarkdownContent";

describe("MarkdownContent", () => {
  it("renders markdown structure instead of plain text", () => {
    render(<MarkdownContent content={"## 结论\n\n- **先做 MVP**\n- 支持表格\n\n| 项 | 值 |\n| --- | --- |\n| 轮次 | 3 |"} />);

    expect(screen.getByRole("heading", { name: "结论" })).toBeTruthy();
    expect(screen.getByText("先做 MVP")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.queryByText("## 结论")).toBeNull();
  });
});
