import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeetingRoundTimeline } from "@/components/MeetingRoundTimeline";
import type { MeetingMessage, MeetingParticipant } from "@/lib/types";

const participant: MeetingParticipant = {
  id: "p1",
  meetingId: "m1",
  modelId: "model-1",
  sortOrder: 0,
  displayNameSnapshot: "模型 A",
  baseUrlSnapshot: "http://localhost/v1",
  modelNameSnapshot: "local",
  identityPromptSnapshot: "",
  createdAt: "2026-06-05T00:00:00.000Z",
};

const baseMessage: MeetingMessage = {
  id: "msg1",
  meetingId: "m1",
  round: 1,
  type: "ai_message",
  speakerName: "模型 A",
  modelId: "model-1",
  content: "正式观点",
  metadata: { reasoningContent: "隐藏推理" },
  createdAt: "2026-06-05T00:00:00.000Z",
};

describe("MeetingRoundTimeline", () => {
  it("hides reasoning content by default and reveals it on demand", () => {
    const { container } = render(<MeetingRoundTimeline messages={[baseMessage]} participants={[participant]} />);

    expect(screen.getByText("正式观点")).toBeTruthy();
    const details = container.querySelector("details.reasoning-panel");
    expect(details).toBeTruthy();
    expect(details?.hasAttribute("open")).toBe(false);

    fireEvent.click(screen.getByText("思考过程"));

    expect(details?.hasAttribute("open")).toBe(true);
    expect(screen.getByText("隐藏推理")).toBeTruthy();
  });

  it("shows streamed pending content instead of only the waiting line", () => {
    render(
      <MeetingRoundTimeline
        messages={[{ ...baseMessage, type: "pending", content: "正在形成观点", metadata: { phase: "streaming", reasoningContent: "先思考" } }]}
        participants={[participant]}
      />,
    );

    expect(screen.getByText("正在形成观点")).toBeTruthy();
    expect(screen.queryByText("正在思考，等待模型返回...")).toBeNull();
  });
});
