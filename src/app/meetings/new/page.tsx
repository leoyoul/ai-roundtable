"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModelView } from "@/components/ModelForm";

export default function NewMeetingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [models, setModels] = useState<ModelView[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/models")
      .then((response) => response.json())
      .then((body) => setModels((body.models ?? []).filter((model: ModelView) => model.enabled)));
  }, []);

  const selectedModels = useMemo(() => models.filter((model) => selected.includes(model.id)), [models, selected]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  function next() {
    setError("");
    if (step === 1 && topic.trim().length === 0) {
      setError("请先填写会议主题");
      return;
    }
    if (step === 2 && selected.length === 0) {
      setError("请选择至少一个参会模型");
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function createMeeting() {
    setError("");
    setCreating(true);
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, model_ids: selected }),
    });
    const body = await response.json();
    setCreating(false);
    if (!response.ok) {
      setError(body.error ?? "创建失败");
      return;
    }
    router.push(`/meetings/${body.meeting.id}`);
  }

  return (
    <main className="app-shell">
      <section className="workspace narrow">
        <header className="page-header">
          <div>
            <span className="eyebrow">创建会议</span>
            <h1>三步准备一场 AI 圆桌</h1>
            <p className="muted">先明确议题，再选择参会模型，最后确认并进入会议工作台。</p>
          </div>
        </header>

        <div className="wizard-shell">
          <ol className="wizard-steps">
            <li className={step >= 1 ? "active" : ""}>1. 主题</li>
            <li className={step >= 2 ? "active" : ""}>2. 模型</li>
            <li className={step >= 3 ? "active" : ""}>3. 确认</li>
          </ol>

          <section className="workspace-card form">
            {step === 1 ? (
              <label className="field">
                <span>会议主题</span>
                <textarea autoFocus value={topic} onChange={(event) => setTopic(event.target.value)} rows={5} placeholder="例如：讨论公司内部首次全员推广 AI 大模型应用的策略，应该分成几步走" />
              </label>
            ) : null}

            {step === 2 ? (
              <div className="field">
                <span>参会模型</span>
                <div className="model-select-grid">
                  {models.map((model) => (
                    <label className={`model-choice ${selected.includes(model.id) ? "selected" : ""}`} key={model.id}>
                      <input type="checkbox" checked={selected.includes(model.id)} onChange={(event) => toggle(model.id, event.target.checked)} />
                      <strong>{model.name}</strong>
                      <span>{model.model}</span>
                      {model.identityPrompt ? <span>身份：{summarizeIdentity(model.identityPrompt)}</span> : <span>身份：未设置</span>}
                      <small>{model.baseUrl}</small>
                    </label>
                  ))}
                  {models.length === 0 ? <p className="muted">暂无启用模型，请先到模型配置添加。</p> : null}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="confirm-box">
                <span className="eyebrow">确认信息</span>
                <h2>{topic}</h2>
                <p className="muted">参会模型：{selectedModels.map((model) => model.name).join("、") || "未选择"}</p>
                <p>创建后会进入会议工作台，你可以再点击“开始自动讨论”。</p>
              </div>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
            <div className="actions">
              {step > 1 ? <button className="button secondary" onClick={() => setStep((current) => current - 1)}>上一步</button> : null}
              {step < 3 ? <button className="button" onClick={next}>下一步</button> : <button className="button" disabled={creating} onClick={createMeeting}>{creating ? "创建中..." : "创建会议"}</button>}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function summarizeIdentity(value: string) {
  return value.length > 56 ? `${value.slice(0, 56)}...` : value;
}
