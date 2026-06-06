"use client";

import { MarkdownContent } from "@/components/MarkdownContent";
import type { MeetingMessage } from "@/lib/types";

export function MeetingTimeline({ messages }: { messages: MeetingMessage[] }) {
  return (
    <div className="timeline">
      {messages.length === 0 ? <p className="muted">暂无发言</p> : null}
      {messages.map((message) => (
        <article className={`message ${message.type === "error" ? "error" : ""} ${message.type === "pending" ? "pending" : ""}`} key={message.id}>
          <div className="message-meta">
            <strong>{message.speakerName}</strong>
            <span>第 {message.round} 轮</span>
            <span>{message.type}</span>
          </div>
          {message.type === "pending" ? <p>正在思考，等待模型返回...</p> : <MarkdownContent content={message.content} />}
        </article>
      ))}
    </div>
  );
}
