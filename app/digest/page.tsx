"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";
import { analyzeMeeting } from "@/lib/analyze";
import { toIsoDate } from "@/lib/dates";
import { buildLocalDigest } from "@/lib/digest";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Digest, StoredDecision, Task } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";

export default function DigestPage() {
  const decisionsStore = useLocalStorage<StoredDecision[]>(
    STORAGE_KEYS.decisions,
    [],
  );
  const tasksStore = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [digests, setDigests] = useState<Digest[] | null>(null);
  const [generatedLocally, setGeneratedLocally] = useState(false);

  async function generate() {
    setError("");
    setLoading(true);
    try {
      const data = await analyzeMeeting({
        mode: "digest",
        today: toIsoDate(new Date()),
        tasks: tasksStore.value,
        previousDecisions: decisionsStore.value,
      });
      const list = Array.isArray(data.digests) ? data.digests : [];
      if (list.length > 0 || data.generatedLocally) {
        setDigests(list);
        setGeneratedLocally(Boolean(data.generatedLocally));
        return;
      }
      setDigests(buildLocalDigest(tasksStore.value, decisionsStore.value));
      setGeneratedLocally(true);
    } catch {
      setError("");
      setDigests(buildLocalDigest(tasksStore.value, decisionsStore.value));
      setGeneratedLocally(true);
    } finally {
      setLoading(false);
    }
  }

  const [copied, setCopied] = useState("");

  function asText(d: Digest) {
    const list = (items: string[]) =>
      items.length ? items.map((i) => `- ${i}`).join("\n") : "- None";
    return [
      `Weekly update for ${d.person}`,
      "",
      d.summary,
      "",
      "Due soon:",
      list(d.dueSoon ?? []),
      "",
      "Decisions affecting you:",
      list(d.decisionsAffectingYou ?? []),
    ].join("\n");
  }

  async function copy(d: Digest) {
    try {
      await navigator.clipboard.writeText(asText(d));
      setCopied(d.person);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 md:p-8">
      <PageHeader
        eyebrow="Digest"
        title="Weekly digest"
        actions={
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow hover:bg-indigo-50 disabled:opacity-60"
          >
            {loading ? "Generating digest…" : "Generate weekly digest"}
          </button>
        }
      >
        <p>
          One short update per person. Task lists and dates come straight from your confirmed data,
          and the AI summary is checked against those facts before it is shown.
        </p>
      </PageHeader>

      <ErrorBanner message={error} onRetry={error ? generate : undefined} />

      {generatedLocally && digests && digests.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800"
        >
          Generated locally
        </div>
      )}

      {digests && digests.length === 0 && (
        <p className="text-sm text-slate-500">
          No people to digest yet. Confirm a meeting first.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {digests?.map((digest) => (
          <article
            key={digest.person}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Avatar name={digest.person} />
              {digest.person}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{digest.summary}</p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due soon
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {(digest.dueSoon ?? []).length === 0 && <li>None</li>}
                {(digest.dueSoon ?? []).map((item, i) => (
                  <li
                    key={`${item}-${i}`}
                    className={item.includes("overdue") ? "font-medium text-red-700" : ""}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Decisions affecting you
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
                {(digest.decisionsAffectingYou ?? []).length === 0 && <li>None</li>}
                {(digest.decisionsAffectingYou ?? []).map((item, i) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy(digest)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                {copied === digest.person ? "Copied ✓" : "Copy update"}
              </button>
              <a
                href={`mailto:?subject=${encodeURIComponent(
                  `Weekly update for ${digest.person}`,
                )}&body=${encodeURIComponent(asText(digest))}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                Open in email
              </a>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
