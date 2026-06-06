"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import { splitThinkingContent } from "@/lib/ai/thinking";
import { getMessageTypeLabel } from "@/lib/meeting/meeting-view-state";
import type { MeetingMessage, MeetingParticipant } from "@/lib/types";

export function MeetingRoundTimeline({
  messages,
  participants,
}: {
  messages: MeetingMessage[];
  participants: MeetingParticipant[];
}) {
  const grouped = groupByRound(messages);

  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <strong>会议尚未开始</strong>
        <p>开始自动讨论后，模型发言、用户插话和系统记录会按轮次沉淀在这里。</p>
      </div>
    );
  }

  return (
    <div className="round-timeline">
      {grouped.map(([round, roundMessages]) => (
        <section className="round-section" key={round}>
          <div className="round-header">
            <div>
              <span className="eyebrow">第 {round} 轮</span>
              <h2>讨论记录</h2>
            </div>
            <div className="speaker-progress">
              {participants.map((participant) => {
                const state = getParticipantState(roundMessages, participant.modelId);
                return (
                  <span className={`speaker-dot ${state}`} key={participant.id} title={`${participant.displayNameSnapshot}：${stateLabel(state)}`}>
                    {participant.displayNameSnapshot.slice(0, 1)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="round-messages">
            {roundMessages.map((message) => (
              <article className={`message-entry ${message.type}`} key={message.id}>
                <div className="message-entry-meta">
                  <strong>{message.speakerName}</strong>
                  <span>{getMessageTypeLabel(message.type)}</span>
                </div>
                <MessageBody message={message} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MessageBody({ message }: { message: MeetingMessage }) {
  const { content, reasoningContent } = getDisplayParts(message);
  const hasContent = content.trim().length > 0 && content !== "正在思考，等待模型返回...";

  return (
    <>
      {message.type === "pending" && !hasContent ? (
        <p className="thinking-line">正在思考，等待模型返回...</p>
      ) : (
        <MarkdownContent content={hasContent ? content : message.content} />
      )}
      {reasoningContent ? (
        <details className="reasoning-panel">
          <summary>思考过程</summary>
          <MarkdownContent content={reasoningContent} />
        </details>
      ) : null}
    </>
  );
}

function getDisplayParts(message: MeetingMessage): { content: string; reasoningContent: string } {
  const metadataContent = typeof message.metadata.displayContent === "string" ? message.metadata.displayContent : "";
  const metadataReasoning = typeof message.metadata.reasoningContent === "string" ? message.metadata.reasoningContent : "";
  const split = splitThinkingContent(message.content);
  return {
    content: metadataContent || split.content || message.content,
    reasoningContent: metadataReasoning || split.reasoningContent,
  };
}

function groupByRound(messages: MeetingMessage[]): Array<[number, MeetingMessage[]]> {
  const map = new Map<number, MeetingMessage[]>();
  for (const message of messages) {
    const group = map.get(message.round) ?? [];
    group.push(message);
    map.set(message.round, group);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
}

function getParticipantState(messages: MeetingMessage[], modelId: string | null): "done" | "pending" | "error" | "waiting" {
  if (!modelId) return "waiting";
  const relevant = messages.filter((message) => message.modelId === modelId);
  if (relevant.some((message) => message.type === "pending")) return "pending";
  if (relevant.some((message) => message.type === "ai_message")) return "done";
  if (relevant.some((message) => message.type === "error")) return "error";
  return "waiting";
}

function stateLabel(state: "done" | "pending" | "error" | "waiting") {
  return {
    done: "已发言",
    pending: "发言中",
    error: "出错",
    waiting: "等待",
  }[state];
}
