import { describe, expect, it } from "vitest";
import { errorResponse, jsonResponse } from "@/lib/api/responses";

describe("api contracts", () => {
  it("sanitizes model list response shape", async () => {
    const response = jsonResponse({
      models: [{
        id: "model-1",
        name: "GPT",
        baseUrl: "https://api.example.com/v1",
        apiKeyMasked: "******",
        model: "gpt-test",
        enabled: true,
      }],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("apiKeyEncrypted");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("returns consistent error shape", async () => {
    const response = errorResponse("Bad request", 400);
    await expect(response.json()).resolves.toEqual({ error: "Bad request" });
    expect(response.status).toBe(400);
  });
});
