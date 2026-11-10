export const FRIENDLY_BUSY =
  "The AI service is busy right now. Please retry in a moment.";

function redact(message: string) {
  let next = message;
  const key = process.env.GEMINI_API_KEY;
  if (key) next = next.split(key).join("[redacted]");
  return next
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/AQ\.[0-9A-Za-z_-]+/g, "[redacted]");
}

function looksLikeRawPayload(message: string) {
  const trimmed = message.trim();
  return (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    /"error"\s*:/.test(trimmed)
  );
}

export function friendlyErrorMessage(error: unknown): string {
  let message = FRIENDLY_BUSY;
  if (error instanceof Error && error.message) message = error.message;
  else if (typeof error === "string" && error.trim()) message = error;
  message = redact(message);
  if (
    looksLikeRawPayload(message) ||
    /GEMINI_API_KEY|api[_ ]?key/i.test(message)
  ) {
    return FRIENDLY_BUSY;
  }
  if (/abort|timeout/i.test(message)) {
    return "The request took too long. Please retry.";
  }
  return message;
}
