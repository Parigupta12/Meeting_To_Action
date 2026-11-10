import { ApiError, GoogleGenAI } from "@google/genai";
import { FRIENDLY_BUSY } from "./errors";

const CALL_TIMEOUT_MS = 12_000;
const TOTAL_BUDGET_MS = 25_000;
const RETRY_DELAYS_MS = [1_000, 2_000];

function timeoutError() {
  return Object.assign(new Error("UNAVAILABLE: timed out"), { status: 503 });
}

function redact(message: string) {
  let next = message;
  const key = process.env.GEMINI_API_KEY;
  if (key) next = next.split(key).join("[redacted]");
  return next
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/AQ\.[0-9A-Za-z_-]+/g, "[redacted]");
}

function extractText(response: {
  text?: string;
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}) {
  if (response.text && response.text.trim()) return response.text;
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export function classifyGeminiError(error: unknown): {
  status: number | null;
  retryable: boolean;
  notFound: boolean;
  message: string;
} {
  let status: number | null = null;
  let message = FRIENDLY_BUSY;

  if (error instanceof ApiError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof Error) {
    message = error.message;
    const match = message.match(/\b(404|429|500|503)\b/);
    if (match) status = Number(match[1]);
    const extraStatus = (error as { status?: number }).status;
    if (typeof extraStatus === "number") status = extraStatus;
    if (error.name === "AbortError") status = 503;
  }

  const blob = `${status ?? ""} ${message}`;
  const notFound =
    status === 404 || /NOT_FOUND|no longer available/i.test(blob);
  const retryable =
    status === 429 ||
    status === 500 ||
    status === 503 ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|timed out|timeout|abort|ECONNRESET|fetch failed/i.test(
      blob,
    );

  return { status, retryable, notFound, message: redact(message) };
}

export function configuredModels() {
  const primary = process.env.GEMINI_MODEL?.trim();
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const models: string[] = [];
  for (const name of [primary, ...fallbacks]) {
    if (name && !seen.has(name)) {
      seen.add(name);
      models.push(name);
    }
  }
  return models;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(timeoutError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(timeoutError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      fn();
    };
    const onAbort = () => finish(() => reject(timeoutError()));
    const timer = setTimeout(() => finish(() => reject(timeoutError())), ms);

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

export type GeminiGenerateResult =
  | { ok: true; text: string; model: string; attempt: number }
  | { ok: false; message: string; reason?: string };

async function callModel(
  ai: GoogleGenAI,
  model: string,
  contents: string,
  systemInstruction: string,
  timeoutMs: number,
  budgetSignal: AbortSignal,
) {
  const controller = new AbortController();
  const onBudgetAbort = () => controller.abort();
  if (budgetSignal.aborted) controller.abort();
  else budgetSignal.addEventListener("abort", onBudgetAbort, { once: true });

  try {
    const generate = ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
        abortSignal: controller.signal,
        httpOptions: {
          timeout: timeoutMs,
          retryOptions: { attempts: 1 },
        },
      },
    });

    const text = extractText(
      await raceWithTimeout(generate, timeoutMs, controller.signal),
    );
    if (!text) {
      throw Object.assign(new Error("UNAVAILABLE: empty model response"), {
        status: 503,
      });
    }
    return text;
  } finally {
    if (!controller.signal.aborted) controller.abort();
    budgetSignal.removeEventListener("abort", onBudgetAbort);
  }
}

export async function generateJsonWithFallback(
  contents: string,
  systemInstruction: string,
  options: { budgetMs?: number } = {},
): Promise<GeminiGenerateResult> {
  const TOTAL = options.budgetMs ?? TOTAL_BUDGET_MS;
  const apiKey = process.env.GEMINI_API_KEY;
  const models = configuredModels();

  if (!apiKey) {
    return {
      ok: false,
      message:
        "The AI service is not configured. Add your Gemini key in .env.local and restart.",
    };
  }

  if (models.length === 0) {
    return {
      ok: false,
      message:
        "No Gemini model is configured. Set GEMINI_MODEL in .env.local and restart.",
    };
  }

  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(), TOTAL);
  const started = Date.now();
  const remaining = () => TOTAL - (Date.now() - started);

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: CALL_TIMEOUT_MS, retryOptions: { attempts: 1 } },
  });

  const reasonByModel = new Map<string, string>();
  const allReasons = () =>
    reasonByModel.size > 0
      ? [...reasonByModel.entries()].map(([m, r]) => `${m} → ${r}`).join(" | ")
      : "No answer from Gemini within the time limit";

  const run = async (): Promise<GeminiGenerateResult> => {
    for (const model of models) {
      if (budget.signal.aborted || remaining() < 400) break;

      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        if (budget.signal.aborted || remaining() < 400) break;

        if (attempt > 0) {
          const delay = RETRY_DELAYS_MS[attempt - 1];
          if (remaining() <= delay) break;
          try {
            await sleep(delay, budget.signal);
          } catch {
            break;
          }
        }

        const timeoutMs = Math.min(CALL_TIMEOUT_MS, Math.max(400, remaining()));

        try {
          const text = await callModel(
            ai,
            model,
            contents,
            systemInstruction,
            timeoutMs,
            budget.signal,
          );
          return { ok: true, text, model, attempt: attempt + 1 };
        } catch (error) {
          const info = classifyGeminiError(error);
          const inner = info.message.match(/"message"\s*:\s*"(.*?)"/)?.[1] ?? info.message;
          const short = `${info.status ?? "error"} ${inner.replace(/\s+/g, " ").slice(0, 90)}`;
          reasonByModel.set(model, short);
          console.warn(`[gemini] model=${model} attempt=${attempt + 1} ${short}`);
          if (info.notFound) break;
          const canRetry = info.retryable && attempt < RETRY_DELAYS_MS.length;
          if (!canRetry) break;
        }
      }
    }

    return { ok: false, message: FRIENDLY_BUSY, reason: allReasons() };
  };

  try {
    return await raceWithTimeout(run(), TOTAL, budget.signal);
  } catch {
    return { ok: false, message: FRIENDLY_BUSY, reason: allReasons() };
  } finally {
    clearTimeout(budgetTimer);
    if (!budget.signal.aborted) budget.abort();
  }
}
