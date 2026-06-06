import { describe, expect, it } from "vitest";
import { isMeetingStatus, isMessageType } from "@/lib/types";

describe("domain type guards", () => {
  it("accepts known meeting statuses", () => {
    expect(isMeetingStatus("draft")).toBe(true);
    expect(isMeetingStatus("running")).toBe(true);
    expect(isMeetingStatus("stopped")).toBe(true);
    expect(isMeetingStatus("converged")).toBe(true);
    expect(isMeetingStatus("ended")).toBe(true);
    expect(isMeetingStatus("failed")).toBe(true);
  });

  it("rejects unknown meeting statuses", () => {
    expect(isMeetingStatus("paused")).toBe(false);
  });

  it("accepts known message types", () => {
    expect(isMessageType("pending")).toBe(true);
    expect(isMessageType("ai_message")).toBe(true);
    expect(isMessageType("user_intervention")).toBe(true);
    expect(isMessageType("system_summary")).toBe(true);
    expect(isMessageType("error")).toBe(true);
  });
});
