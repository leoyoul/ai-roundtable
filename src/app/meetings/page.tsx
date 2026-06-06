"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Meeting } from "@/lib/types";

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    fetch("/api/meetings")
      .then((response) => response.json())
      .then((body) => setMeetings(body.meetings ?? []));
  }, []);

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="page-header">
          <div>
            <span className="eyebrow">历史会议</span>
            <h1>会议记录</h1>
            <p className="muted">查看过往主题、讨论进度、收敛状态，并继续生成纪要。</p>
          </div>
          <Link className="button" href="/meetings/new">创建会议</Link>
        </div>

        <div className="meeting-list">
          {meetings.map((meeting) => (
            <Link className="meeting-row" href={`/meetings/${meeting.id}`} key={meeting.id}>
              <div>
                <strong>{meeting.topic}</strong>
                <p className="muted">创建时间：{new Date(meeting.createdAt).toLocaleString()}</p>
              </div>
              <div className="meeting-row-meta">
                <span>第 {meeting.currentRound} 轮</span>
                <span>收敛：{meeting.convergenceScore ?? "-"}</span>
                <span className={`status-pill phase-${phaseForStatus(meeting.status)}`}>{statusLabel(meeting.status)}</span>
              </div>
            </Link>
          ))}
          {meetings.length === 0 ? (
            <div className="empty-state">
              <strong>暂无会议</strong>
              <p>创建第一场会议后，完整记录和最终纪要会出现在这里。</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function statusLabel(status: Meeting["status"]) {
  return {
    draft: "待开始",
    running: "讨论中",
    stopped: "已停止",
    converged: "已收敛",
    ended: "已结束",
    failed: "失败",
  }[status];
}

function phaseForStatus(status: Meeting["status"]) {
  return {
    draft: "draft",
    running: "discussing",
    stopped: "stopped",
    converged: "converged",
    ended: "ended",
    failed: "failed",
  }[status];
}
