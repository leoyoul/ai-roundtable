import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const algorithm = "aes-256-gcm";
const keyFilePath = path.join(process.cwd(), "data", "secret.key");

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export function getOrCreateLocalSecret(): string {
  if (process.env.AI_ROUNDTABLE_SECRET) {
    return process.env.AI_ROUNDTABLE_SECRET;
  }

  fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });

  if (fs.existsSync(keyFilePath)) {
    return fs.readFileSync(keyFilePath, "utf8").trim();
  }

  const secret = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(keyFilePath, secret, { mode: 0o600 });
  return secret;
}

export function encryptApiKey(apiKey: string, secret = getOrCreateLocalSecret()): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptApiKey(encryptedValue: string, secret = getOrCreateLocalSecret()): string {
  const [ivText, tagText, encryptedText] = encryptedValue.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted API key");
  }

  const decipher = crypto.createDecipheriv(algorithm, deriveKey(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskApiKey(apiKey: string | null): string {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return "****";
  }

  return `${apiKey.slice(0, 3)}****${apiKey.slice(-4)}`;
}
