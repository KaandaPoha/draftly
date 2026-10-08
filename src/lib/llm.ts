/**
 * Real LLM transport — server-side only.
 *
 * Supports any OpenAI-compatible chat-completions endpoint (OpenAI, Groq,
 * Together, OpenRouter, DeepSeek, a local Ollama/vLLM, ...) and Anthropic's
 * Messages API. Nothing here runs in the browser and no key is ever sent to
 * the client.
 *
 * Every function either returns a real model response or throws a typed
 * LlmError. It never fabricates a response — if the provider is unreachable
 * the caller must fall back and say so.
 */

export type ProviderKind = "openai" | "anthropic";

export type ProviderConfig = {
  kind: ProviderKind;
  apiKey: string;
  model: string;
  baseUrl: string;
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "auth"
      | "rate_limit"
      | "timeout"
      | "bad_response"
      | "network"
  ) {
    super(message);
    this.name = "LlmError";
  }

  /** A short, non-technical sentence suitable for showing a user. */
  get friendly(): string {
    switch (this.code) {
      case "not_configured":
        return "No AI provider is configured, so Draftly used its built-in generator.";
      case "auth":
        return "The AI provider rejected the API key. Check AI_API_KEY and try again.";
      case "rate_limit":
        return "The AI provider is rate-limiting requests right now. Draftly used its built-in generator instead.";
      case "timeout":
        return "The AI provider took too long to respond. Draftly used its built-in generator instead.";
      case "bad_response":
        return "The AI provider returned something Draftly could not read. It used its built-in generator instead.";
      default:
        return "Could not reach the AI provider. Draftly used its built-in generator instead.";
    }
  }
}

const DEFAULT_BASE: Record<ProviderKind, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

const DEFAULT_MODEL: Record<ProviderKind, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

/**
 * Read provider settings from the environment. Returns null when no key is
 * set, which keeps every caller honest about running in demo mode.
 */
export function providerConfig(): ProviderConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  const raw = (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();
  const kind: ProviderKind = raw === "anthropic" ? "anthropic" : "openai";

  return {
    kind,
    apiKey,
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL[kind],
    baseUrl: (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE[kind]).replace(/\/$/, ""),
  };
}

export function aiConfigured(): boolean {
  return providerConfig() !== null;
}

/** Provider + model name for showing users which engine produced a draft. */
export function providerLabel(): string | null {
  const cfg = providerConfig();
  return cfg ? `${cfg.kind}:${cfg.model}` : null;
}

const TIMEOUT_MS = 60_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new LlmError("Provider timed out", "timeout");
    }
    throw new LlmError("Network error reaching provider", "network");
  } finally {
    clearTimeout(timer);
  }
}

function classify(status: number, body: string): LlmError {
  if (status === 401 || status === 403) return new LlmError(`Auth failed: ${body}`, "auth");
  if (status === 429) return new LlmError(`Rate limited: ${body}`, "rate_limit");
  return new LlmError(`Provider error ${status}: ${body}`, "bad_response");
}

/**
 * One completion call. `system` sets the persona, `user` carries the task.
 * Returns the assistant's raw text — parsing structured output is the
 * caller's job (see prompt.ts).
 */
export async function complete(
  system: string,
  user: string,
  opts: { maxTokens?: number; json?: boolean } = {}
): Promise<string> {
  const cfg = providerConfig();
  if (!cfg) throw new LlmError("AI_API_KEY is not set", "not_configured");

  const maxTokens = opts.maxTokens ?? 2000;

  if (cfg.kind === "anthropic") {
    const res = await fetchWithTimeout(`${cfg.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    const text = await res.text();
    if (!res.ok) throw classify(res.status, text.slice(0, 400));

    let parsed: { content?: Array<{ type: string; text?: string }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new LlmError("Anthropic returned non-JSON", "bad_response");
    }
    const out = (parsed.content ?? [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text)
      .join("\n")
      .trim();
    if (!out) throw new LlmError("Anthropic returned an empty message", "bad_response");
    return out;
  }

  // OpenAI-compatible
  const res = await fetchWithTimeout(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  const text = await res.text();
  if (!res.ok) throw classify(res.status, text.slice(0, 400));

  let parsed: { choices?: Array<{ message?: { content?: string } }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LlmError("Provider returned non-JSON", "bad_response");
  }
  const out = parsed.choices?.[0]?.message?.content?.trim();
  if (!out) throw new LlmError("Provider returned an empty message", "bad_response");
  return out;
}

/**
 * Pull the first JSON object/array out of a model reply. Models routinely
 * wrap JSON in prose or ```json fences; this tolerates that rather than
 * failing the whole generation.
 */
export function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], raw];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const start = candidate.search(/[[{]/);
    if (start === -1) continue;
    // Walk to the matching closing bracket.
    const open = candidate[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(candidate.slice(start, i + 1)) as T;
          } catch {
            break; // try the next candidate
          }
        }
      }
    }
  }
  throw new LlmError("Could not find JSON in the model response", "bad_response");
}

/** Cheap connectivity check used by the Settings page. */
export async function testConnection(): Promise<
  { ok: true; model: string } | { ok: false; error: string }
> {
  const cfg = providerConfig();
  if (!cfg) return { ok: false, error: "No AI_API_KEY is set." };

  try {
    const reply = await complete(
      "You are a connectivity probe. Reply with exactly: OK",
      "Reply with exactly: OK",
      { maxTokens: 16 }
    );
    return { ok: true, model: `${cfg.kind}:${cfg.model} (replied “${reply.slice(0, 20)}”)` };
  } catch (err) {
    if (err instanceof LlmError) return { ok: false, error: err.friendly };
    return { ok: false, error: "Unknown error contacting the provider." };
  }
}