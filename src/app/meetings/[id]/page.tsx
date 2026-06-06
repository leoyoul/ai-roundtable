"use client";

import { useEffect, useState } from "react";
import { MeetingControls } from "@/components/MeetingControls";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MeetingRoundTimeline } from "@/components/MeetingRoundTimeline";
import type { FinalReport, Meeting, MeetingMessage, MeetingParticipant, MeetingViewState, RoundReport } from "@/lib/types";

interface Detail {
  meeting: Meeting;
  participants: MeetingParticipant[];
  messages: MeetingMessage[];
  roundReports: RoundReport[];
  finalReport: FinalReport | null;
  viewState: MeetingViewState;
}

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [meetingId, setMeetingId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [intervention, setIntervention] = useState("");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    params.then(({ id }) => {
      setMeetingId(id);
      void loadDetail(id);
    });
  }, [params]);

  useEffect(() => {
    if (!meetingId) return;
    if (detail?.viewState.phase === "discussing" || detail?.viewState.phase === "judging") {
      return;
    }
    const timer = window.setInterval(() => {
      void loadDetail(meetingId);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [meetingId, detail?.viewState.phase]);

  useEffect(() => {
    if (!meetingId || (detail?.viewState.phase !== "discussing" && detail?.viewState.phase !== "judging")) return;
    const source = new EventSource(`/api/meetings/${meetingId}/events`);
    let fallbackTimer: number | null = null;

    source.addEventListener("detail", (event) => {
      try {
        const body = JSON.parse((event as MessageEvent).data);
        if (body?.viewState) {
          setDetail(body);
        }
      } catch {
        return;
      }
    });
    source.onerror = () => {
      source.close();
      fallbackTimer = window.setInterval(() => {
        void loadDetail(meetingId);
      }, 500);
    };

    return () => {
      source.close();
      if (fallbackTimer) {
        window.clearInterval(fallbackTimer);
      }
    };
  }, [meetingId, detail?.viewState.phase]);

  async function loadDetail(id = meetingId) {
    if (!id) return;
    try {
      const response = await fetch(`/api/meetings/${id}`);
      const body = await response.json();
      if (!response.ok || !body?.viewState) {
        return;
      }
      setDetail(body);
    } catch {
      return;
    }
  }

  async function sendIntervention() {
    const response = await fetch(`/api/meetings/${meetingId}/interventions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: intervention }),
    });
    const body = await response.json();
    if (response.ok) {
      setStatusText(body.statusText);
      setIntervention("");
      await loadDetail();
    }
  }

  if (!detail) {
    return <main className="app-shell"><section className="workspace workspace-card">加载中...</section></main>;
  }
  const elapsedText = getElapsedText(detail.meeting.startedAt);

  return (
    <main className="app-shell">
      <div className="workspace meeting-workspace">
        <section className="meeting-main">
          <header className="meeting-header">
            <div>
              <span className="eyebrow">会议主题</span>
              <h1>{detail.meeting.topic}</h1>
            </div>
            <span className={`status-pill phase-${detail.viewState.phase}`}>{detail.viewState.phaseLabel}</span>
          </header>

          <div className="meeting-stats">
            <div>
              <span>当前轮次</span>
              <strong>第 {detail.meeting.currentRound} 轮</strong>
            </div>
            <div>
              <span>收敛分数</span>
              <strong>{detail.meeting.convergenceScore ?? "-"}</strong>
            </div>
            <div>
              <span>本轮进度</span>
              <strong>{detail.viewState.roundProgress.completed}/{detail.viewState.roundProgress.total}</strong>
            </div>
            <div>
              <span>已用时间</span>
              <strong>{elapsedText}</strong>
            </div>
          </div>

          <div className="participants-line">
            {detail.participants.map((item) => <span key={item.id}>{item.displayNameSnapshot}</span>)}
          </div>

          {detail.viewState.phase === "discussing" ? (
            <p className="form-message">自动讨论中：{detail.viewState.activeSpeakerName ?? "模型"} 正在思考或输出，本页面会自动刷新进度。</p>
          ) : null}

          <MeetingRoundTimeline messages={detail.messages} participants={detail.participants} />

          <section className="intervention-bar">
            <label className="field">
              <span>插入下一轮讨论</span>
              <textarea placeholder="输入你的引导、补充事实或要求，发送后会进入会议记录并影响下一轮上下文。" value={intervention} onChange={(event) => setIntervention(event.target.value)} rows={3} />
            </label>
            <button className="button secondary" disabled={!intervention.trim()} onClick={sendIntervention}>发送插话</button>
            {statusText ? <p className="form-message">{statusText}</p> : null}
          </section>
        </section>

        <aside className="meeting-sidebar">
          <MeetingControls meetingId={meetingId} viewState={detail.viewState} hasFinalReport={Boolean(detail.finalReport)} onChanged={() => loadDetail()} />
          <section className="workspace-card">
            <h2>收敛判断</h2>
            {detail.meeting.currentRound < 3 ? (
              <p className="muted">至少完成 3 轮且每个模型都有有效发言后，才会开始收敛判断。</p>
            ) : null}
            {detail.roundReports.map((report) => (
              <article className="report" key={report.id}>
                <strong>第 {report.round} 轮：{report.convergenceScore}</strong>
                <p>{report.reason}</p>
                <p className="muted">共识：{report.consensusPoints.join("、") || "无"}</p>
                <p className="muted">分歧：{report.disagreementPoints.join("、") || "无"}</p>
                <p className="muted">问题：{report.openQuestions.join("、") || "无"}</p>
              </article>
            ))}
            {detail.roundReports.length === 0 ? <p className="muted">暂无判断</p> : null}
          </section>
          {detail.finalReport ? (
            <section className="workspace-card final-report-card" id="final-report">
              <h2>最终纪要</h2>
              <MarkdownContent content={detail.finalReport.markdown} />
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function getElapsedText(startedAt: string | null) {
  if (!startedAt) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}
