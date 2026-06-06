"use client";

import { FormEvent, useEffect, useState } from "react";

export interface ModelView {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  identityPrompt: string;
  enabled: boolean;
}

export function ModelForm({ editing, onSaved }: { editing?: ModelView | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [identityPrompt, setIdentityPrompt] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [clearKey, setClearKey] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setName(editing?.name ?? "");
    setBaseUrl(editing?.baseUrl ?? "");
    setApiKey("");
    setModel(editing?.model ?? "");
    setIdentityPrompt(editing?.identityPrompt ?? "");
    setEnabled(editing?.enabled ?? true);
    setClearKey(false);
  }, [editing]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const payload = {
      name,
      base_url: baseUrl,
      api_key: editing ? (clearKey ? "" : apiKey.trim() ? apiKey : null) : apiKey || null,
      model,
      identity_prompt: identityPrompt,
      enabled,
    };
    const response = await fetch(editing ? `/api/models/${editing.id}` : "/api/models", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error ?? "保存失败");
      return;
    }
    setMessage("已保存");
    setApiKey("");
    onSaved();
  }

  return (
    <form className="panel form" onSubmit={submit}>
      <h2>{editing ? "编辑模型" : "新增模型"}</h2>
      <label className="field">
        <span>名称</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="field">
        <span>Base URL</span>
        <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
      </label>
      <label className="field">
        <span>API Key</span>
        <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={editing ? "留空则保留" : "本地模型可留空"} />
      </label>
      {editing ? (
        <label className="checkbox-row">
          <input type="checkbox" checked={clearKey} onChange={(event) => setClearKey(event.target.checked)} />
          <span>清空 Key</span>
        </label>
      ) : null}
      <label className="field">
        <span>模型名</span>
        <input value={model} onChange={(event) => setModel(event.target.value)} required />
      </label>
      <label className="field">
        <span>身份提示词</span>
        <textarea
          value={identityPrompt}
          onChange={(event) => setIdentityPrompt(event.target.value)}
          rows={5}
          placeholder="例如：你是偏财务视角的 CFO，重点关注成本、ROI、风险和落地节奏。"
        />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        <span>启用</span>
      </label>
      <button className="button" type="submit">保存模型</button>
      {message ? <p className="form-message">{message}</p> : null}
    </form>
  );
}
