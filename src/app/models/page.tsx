"use client";

import { useEffect, useState } from "react";
import { ModelForm, type ModelView } from "@/components/ModelForm";

export default function ModelsPage() {
  const [models, setModels] = useState<ModelView[]>([]);
  const [editing, setEditing] = useState<ModelView | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  async function loadModels() {
    const response = await fetch("/api/models");
    const body = await response.json();
    setModels(body.models ?? []);
  }

  useEffect(() => {
    void loadModels();
  }, []);

  async function deleteModel(id: string) {
    await fetch(`/api/models/${id}`, { method: "DELETE" });
    setEditing(null);
    await loadModels();
  }

  async function testModel(id: string) {
    setTestResults((current) => ({ ...current, [id]: "测试中..." }));
    const response = await fetch(`/api/models/${id}/test`, { method: "POST" });
    const body = await response.json();
    setTestResults((current) => ({ ...current, [id]: body.ok ? "连接成功" : body.error ?? "连接失败" }));
  }

  return (
    <main className="app-shell">
      <div className="workspace grid two">
        <ModelForm editing={editing} onSaved={loadModels} />
        <section className="workspace-card">
          <div className="section-header">
            <div>
              <span className="eyebrow">模型配置</span>
              <h1>参会模型清单</h1>
              <p className="muted">云端模型和本地模型都按 OpenAI 兼容接口保存，只在本地记录连接配置。</p>
            </div>
            <span className="status-pill">{models.filter((model) => model.enabled).length}/{models.length} 启用</span>
          </div>
          <div className="model-list">
            {models.map((model) => (
              <article className="model-card" key={model.id}>
                <div className="model-card-main">
                  <div>
                    <strong>{model.name}</strong>
                    <span className={`status-pill ${model.enabled ? "phase-ended" : ""}`}>{model.enabled ? "启用" : "停用"}</span>
                  </div>
                  <p>{model.model}</p>
                  <dl>
                    <div><dt>Base URL</dt><dd>{model.baseUrl}</dd></div>
                    <div><dt>Key 状态</dt><dd>{model.apiKeyMasked || "本地模型/无 Key"}</dd></div>
                    <div><dt>身份</dt><dd>{model.identityPrompt ? summarizeIdentity(model.identityPrompt) : "未设置"}</dd></div>
                    <div><dt>连接测试</dt><dd>{testResults[model.id] ?? "未测试"}</dd></div>
                  </dl>
                </div>
                <div className="row-actions">
                  <button className="button secondary" onClick={() => setEditing(model)}>编辑</button>
                  <button className="button secondary" onClick={() => testModel(model.id)}>测试连接</button>
                  <button className="button ghost" onClick={() => deleteModel(model.id)}>删除</button>
                </div>
              </article>
            ))}
            {models.length === 0 ? (
              <div className="empty-state">
                <strong>还没有模型</strong>
                <p>先添加至少一个模型，才能创建圆桌会议。</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function summarizeIdentity(value: string) {
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
}
