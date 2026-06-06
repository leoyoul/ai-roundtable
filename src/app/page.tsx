"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Meeting, ModelConfig } from "@/lib/types";

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [models, setModels] = useState<ModelConfig[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch("/api/meetings").then((response) => response.json()),
      fetch("/api/models").then((response) => response.json()),
    ]).then(([meetingBody, modelBody]) => {
      setMeetings(meetingBody.meetings ?? []);
      setModels(modelBody.models ?? []);
    });
  }, []);

  const latestMeeting = meetings[0];
  const enabledModels = useMemo(() => models.filter((model) => model.enabled), [models]);

  return (
    <main className="app-shell">
      <section className="workspace">
        <div className="home-hero">
          <div>
            <span className="eyebrow">AI 会议纪要工具</span>
            <h1>让多个模型围绕一个主题形成可下载的会议结论</h1>
            <p>配置云端或本地模型，自动组织多轮讨论；你可以随时插话、停止、继续，并把完整会议记录导出。</p>
            <div className="actions">
              <Link className="button" href="/meetings/new">创建会议</Link>
              {latestMeeting ? <Link className="button secondary" href={`/meetings/${latestMeeting.id}`}>继续最近会议</Link> : null}
              <Link className="button secondary" href="/models">模型配置</Link>
            </div>
          </div>
          <div className="home-status workspace-card">
            <h2>当前准备情况</h2>
            <div className="status-metrics">
              <div><span>可用模型</span><strong>{enabledModels.length}</strong></div>
              <div><span>历史会议</span><strong>{meetings.length}</strong></div>
              <div><span>最近状态</span><strong>{latestMeeting ? statusLabel(latestMeeting.status) : "暂无"}</strong></div>
            </div>
            {latestMeeting ? (
              <Link className="latest-link" href={`/meetings/${latestMeeting.id}`}>
                <span>最近会议</span>
                <strong>{latestMeeting.topic}</strong>
              </Link>
            ) : (
              <p className="muted">先添加模型，然后创建第一场圆桌会议。</p>
            )}
          </div>
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
