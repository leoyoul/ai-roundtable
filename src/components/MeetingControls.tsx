"use client";

import { useState } from "react";
import type { MeetingViewState } from "@/lib/types";

export function MeetingControls({
  meetingId,
  viewState,
  hasFinalReport,
  onChanged,
}: {
  meetingId: string;
  viewState: MeetingViewState;
  hasFinalReport: boolean;
  onChanged: () => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function post(path: string) {
    setLoading(true);
    setMessage("自动讨论中：模型会连续发言，直到收敛或达到 20 轮。");
    const response = await fetch(path, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || body.ok === false) {
      setMessage(body.error ?? "操作失败");
      return;
    }
    onChanged();
    setMessage(body.meeting?.status === "stopped" ? "已停止讨论。" : "");
  }

  async function stop() {
    setMessage("正在停止讨论...");
    const response = await fetch(`/api/meetings/${meetingId}/stop`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      setMessage(body.error ?? "停止失败");
      return;
    }
    setLoading(false);
    onChanged();
    setMessage("已停止讨论。");
  }

  return (
    <div className="workspace-card controls">
      <h2>会议控制</h2>
      <div className="control-status">
        <span className={`status-pill phase-${viewState.phase}`}>{viewState.phaseLabel}</span>
        <p>
          {viewState.activeSpeakerName
            ? `${viewState.activeSpeakerName} 正在发言`
            : viewState.phase === "stopped"
              ? "已停止，可继续自动讨论或生成当前纪要。"
              : "控制会议推进和纪要生成。"}
        </p>
      </div>
      {viewState.canStart ? <button className="button" disabled={loading} onClick={() => post(`/api/meetings/${meetingId}/start`)}>{loading ? "自动讨论中..." : "开始自动讨论"}</button> : null}
      {viewState.canStop || loading ? <button className="button danger" onClick={stop}>停止讨论</button> : null}
      {viewState.canContinue ? (
        <>
          <button className="button secondary" disabled={loading} onClick={() => post(`/api/meetings/${meetingId}/continue`)}>{loading ? "自动讨论中..." : "继续自动讨论"}</button>
        </>
      ) : null}
      {viewState.canFinalize ? <button className="button" disabled={loading} onClick={() => post(`/api/meetings/${meetingId}/finalize`)}>{loading ? "生成中..." : "生成纪要"}</button> : null}
      {hasFinalReport ? (
        <div className="export-actions">
          <a className="button secondary" href="#final-report">预览纪要</a>
          <a className="button secondary" href={`/api/meetings/${meetingId}/export.md`}>导出 Markdown</a>
          <a className="button secondary" href={`/api/meetings/${meetingId}/export.json`}>导出 JSON</a>
        </div>
      ) : null}
      {message ? <p className={message.includes("失败") ? "error-text" : "form-message"}>{message}</p> : null}
    </div>
  );
}
