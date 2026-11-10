// Usage: npm run check-gemini
// Lists the Gemini models your key can use and tests which ones actually answer right now.
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.log("GEMINI_API_KEY is missing. Put it in .env.local first.");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: key });

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out after " + ms / 1000 + "s")), ms)),
  ]);

const configured = [
  process.env.GEMINI_MODEL,
  ...(process.env.GEMINI_FALLBACK_MODELS ?? "").split(","),
]
  .map((m) => (m ?? "").trim())
  .filter(Boolean);

const found = [];
try {
  const pager = await withTimeout(ai.models.list({ config: { pageSize: 100 } }), 20000);
  for await (const m of pager) {
    const name = (m.name ?? "").replace(/^models\//, "");
    const actions = m.supportedActions ?? [];
    if (
      /flash/i.test(name) &&
      !/image|tts|live|audio|embedding|robotics|computer|native/i.test(name) &&
      (actions.length === 0 || actions.includes("generateContent"))
    ) {
      found.push(name);
    }
  }
  console.log("Flash models your key can see:", found.length ? found.join(", ") : "(none)");
} catch (error) {
  console.log("Could not list models:", String(error?.message ?? error).slice(0, 200));
}

const candidates = [...new Set([...configured, ...found.slice(0, 8)])];
console.log("\nTesting " + candidates.length + " model(s) with a tiny request...\n");

let firstOk = null;
for (const model of candidates) {
  const started = Date.now();
  try {
    const res = await withTimeout(
      ai.models.generateContent({ model, contents: "Reply with the single word OK." }),
      15000,
    );
    const text = (res.text ?? "").trim().slice(0, 20);
    console.log(`OK    ${model}  (${Date.now() - started} ms)  replied: ${text}`);
    firstOk ??= model;
  } catch (error) {
    const raw = String(error?.message ?? error);
    const inner = raw.match(/"message"\s*:\s*"(.*?)"/)?.[1] ?? raw;
    console.log(`FAIL  ${model}  ${inner.replace(/\s+/g, " ").slice(0, 110)}`);
  }
}

console.log(
  firstOk
    ? `\nSuggested .env.local line:  GEMINI_MODEL=${firstOk}`
    : "\nNo model answered. If every line says 503, Gemini is busy: wait a few minutes and run this again.",
);
