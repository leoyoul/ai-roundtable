import { describe, expect, it } from "vitest";
import { decryptApiKey, encryptApiKey, maskApiKey } from "@/lib/security/key-store";

const secret = "test-secret-with-enough-length";

describe("key store", () => {
  it("encrypts and decrypts API keys", () => {
    const encrypted = encryptApiKey("sk-test-123456", secret);

    expect(encrypted).not.toContain("sk-test");
    expect(decryptApiKey(encrypted, secret)).toBe("sk-test-123456");
  });

  it("rejects decrypting with the wrong secret", () => {
    const encrypted = encryptApiKey("sk-test-123456", secret);

    expect(() => decryptApiKey(encrypted, "wrong-secret")).toThrow();
  });

  it("masks API keys", () => {
    expect(maskApiKey("sk-abcdef123456")).toBe("sk-****3456");
    expect(maskApiKey(null)).toBe("");
  });
});
