import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { decryptApiKey, encryptApiKey } from "@/lib/security/key-store";
import { nowIso, requireNonEmpty } from "@/lib/validation";

export interface CreateModelInput {
  name: string;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  identityPrompt: string;
  enabled: boolean;
}

export interface UpdateModelInput extends CreateModelInput {}

export interface ModelListItem {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  model: string;
  identityPrompt: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelForCall {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string | null;
  keyUnavailable: boolean;
  model: string;
  identityPrompt: string;
  enabled: boolean;
}

interface ModelRow {
  id: string;
  name: string;
  base_url: string;
  api_key_encrypted: string | null;
  model: string;
  identity_prompt: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export function createModel(db: Database.Database, input: CreateModelInput): ModelListItem {
  const id = crypto.randomUUID();
  const now = nowIso();
  const apiKeyEncrypted = input.apiKey ? encryptApiKey(input.apiKey) : null;

  db.prepare(`
    INSERT INTO models (id, name, base_url, api_key_encrypted, model, identity_prompt, enabled, created_at, updated_at)
    VALUES (@id, @name, @baseUrl, @apiKeyEncrypted, @model, @identityPrompt, @enabled, @createdAt, @updatedAt)
  `).run({
    id,
    name: requireNonEmpty(input.name, "name"),
    baseUrl: requireNonEmpty(input.baseUrl, "base_url"),
    apiKeyEncrypted,
    model: requireNonEmpty(input.model, "model"),
    identityPrompt: input.identityPrompt.trim(),
    enabled: input.enabled ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  return listModels(db).find((model) => model.id === id)!;
}

export function updateModel(db: Database.Database, id: string, input: UpdateModelInput): ModelListItem {
  const existing = getModelRow(db, id);
  if (!existing) {
    throw new Error("Model not found");
  }

  const apiKeyEncrypted = input.apiKey === null
    ? existing.api_key_encrypted
    : input.apiKey.trim().length > 0
      ? encryptApiKey(input.apiKey)
      : null;

  db.prepare(`
    UPDATE models
    SET name = @name,
        base_url = @baseUrl,
        api_key_encrypted = @apiKeyEncrypted,
        model = @model,
        identity_prompt = @identityPrompt,
        enabled = @enabled,
        updated_at = @updatedAt
    WHERE id = @id
  `).run({
    id,
    name: requireNonEmpty(input.name, "name"),
    baseUrl: requireNonEmpty(input.baseUrl, "base_url"),
    apiKeyEncrypted,
    model: requireNonEmpty(input.model, "model"),
    identityPrompt: input.identityPrompt.trim(),
    enabled: input.enabled ? 1 : 0,
    updatedAt: nowIso(),
  });

  return listModels(db).find((model) => model.id === id)!;
}

export function deleteModel(db: Database.Database, id: string): void {
  db.prepare("DELETE FROM models WHERE id = ?").run(id);
}

export function listModels(db: Database.Database): ModelListItem[] {
  const rows = db.prepare(`
    SELECT id, name, base_url, api_key_encrypted, model, identity_prompt, enabled, created_at, updated_at
    FROM models
    ORDER BY created_at DESC
  `).all() as ModelRow[];

  return rows.map(mapModelListItem);
}

export function getModelForCall(db: Database.Database, id: string): ModelForCall | null {
  const row = getModelRow(db, id);
  if (!row) {
    return null;
  }

  let apiKey: string | null = null;
  let keyUnavailable = false;
  if (row.api_key_encrypted) {
    try {
      apiKey = decryptApiKey(row.api_key_encrypted);
    } catch {
      keyUnavailable = true;
    }
  }

  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey,
    keyUnavailable,
    model: row.model,
    identityPrompt: row.identity_prompt,
    enabled: row.enabled === 1,
  };
}

export function mapModelListItem(row: ModelRow): ModelListItem {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKeyMasked: row.api_key_encrypted ? "******" : "",
    model: row.model,
    identityPrompt: row.identity_prompt,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getModelRow(db: Database.Database, id: string): ModelRow | undefined {
  return db.prepare(`
    SELECT id, name, base_url, api_key_encrypted, model, identity_prompt, enabled, created_at, updated_at
    FROM models
    WHERE id = ?
  `).get(id) as ModelRow | undefined;
}
