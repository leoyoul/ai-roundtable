export interface ParsedConvergence {
  consensusPoints: string[];
  disagreementPoints: string[];
  openQuestions: string[];
  convergenceScore: number;
  shouldEnd: boolean;
  reason: string;
}

export function parseConvergenceResult(content: string): ParsedConvergence {
  const parsed = JSON.parse(content);
  const score = Number(parsed.convergence_score);

  return {
    consensusPoints: toStringArray(parsed.consensus_points),
    disagreementPoints: toStringArray(parsed.disagreement_points),
    openQuestions: toStringArray(parsed.open_questions),
    convergenceScore: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0,
    shouldEnd: Boolean(parsed.should_end),
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}

export function parseFinalReportResult(content: string): {
  consensus: string[];
  disagreements: string[];
  conclusion: string;
  actionItems: string[];
} {
  const parsed = JSON.parse(content);
  const conclusion = typeof parsed.conclusion === "string" ? parsed.conclusion.trim() : "";
  if (!conclusion) {
    throw new Error("Final report conclusion is required");
  }
  return {
    consensus: toStringArray(parsed.consensus),
    disagreements: toStringArray(parsed.disagreements),
    conclusion,
    actionItems: toStringArray(parsed.action_items),
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
