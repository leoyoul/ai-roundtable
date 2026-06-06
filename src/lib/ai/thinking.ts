const thinkingTagPattern = /<(think|thinking|reasoning)\b[^>]*>/i;

export interface SplitThinkingResult {
  content: string;
  reasoningContent: string;
  hasOpenThinkingBlock: boolean;
}

export function splitThinkingContent(rawContent: string): SplitThinkingResult {
  let cursor = 0;
  let content = "";
  let reasoningContent = "";
  let hasOpenThinkingBlock = false;

  while (cursor < rawContent.length) {
    const remaining = rawContent.slice(cursor);
    const startMatch = remaining.match(thinkingTagPattern);
    if (!startMatch || startMatch.index === undefined) {
      content += remaining;
      break;
    }

    const startIndex = cursor + startMatch.index;
    const tagName = startMatch[1];
    const blockStart = startIndex + startMatch[0].length;
    content += rawContent.slice(cursor, startIndex);

    const endPattern = new RegExp(`</${tagName}>`, "i");
    const afterStart = rawContent.slice(blockStart);
    const endMatch = afterStart.match(endPattern);
    if (!endMatch || endMatch.index === undefined) {
      reasoningContent += afterStart;
      hasOpenThinkingBlock = true;
      break;
    }

    const blockEnd = blockStart + endMatch.index;
    reasoningContent += rawContent.slice(blockStart, blockEnd);
    cursor = blockEnd + endMatch[0].length;
  }

  return {
    content: normalizeExtractedText(content),
    reasoningContent: normalizeExtractedText(reasoningContent),
    hasOpenThinkingBlock,
  };
}

export function joinReasoningContent(parts: Array<string | null | undefined>): string {
  return normalizeExtractedText(parts.filter(Boolean).join("\n\n"));
}

function normalizeExtractedText(value: string): string {
  return value.replace(/\n{3,}/g, "\n\n").trim();
}
