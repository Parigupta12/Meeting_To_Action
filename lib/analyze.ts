import { friendlyErrorMessage, FRIENDLY_BUSY } from "./errors";
import type {
  AnalyzeRequest,
  CommandPlan,
  DigestResult,
  ExtractResult,
} from "./types";

const CLIENT_TIMEOUT_MS = 35_000;

export class AnalyzeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyzeError";
  }
}

export async function analyzeMeeting(
  payload: AnalyzeRequest,
  options: { signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  const onOuterAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: { error?: string } & Partial<ExtractResult> &
      Partial<DigestResult> &
      Partial<CommandPlan>;
    try {
      data = await res.json();
    } catch {
      throw new AnalyzeError("The server returned an invalid response.");
    }

    if (!res.ok || data.error) {
      throw new AnalyzeError(
        friendlyErrorMessage(data.error || FRIENDLY_BUSY),
      );
    }

    return data;
  } catch (error) {
    if (error instanceof AnalyzeError) throw error;
    throw new AnalyzeError(friendlyErrorMessage(error));
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
}
