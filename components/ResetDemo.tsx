"use client";

import { useState } from "react";
import { EMPTY_DRAFT, type MeetingDraft } from "@/lib/draft";
import { STORAGE_KEYS } from "@/lib/storage";
import type { StoredDecision, Task } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";

/** Wipes memory, tasks and the draft so the demo can be run again from a clean start. */
export default function ResetDemo() {
  const decisions = useLocalStorage<StoredDecision[]>(STORAGE_KEYS.decisions, []);
  const tasks = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);
  const draft = useLocalStorage<MeetingDraft>(STORAGE_KEYS.draft, EMPTY_DRAFT);
  const flash = useLocalStorage<string>(STORAGE_KEYS.flash, "");
  const [armed, setArmed] = useState(false);

  const hasData =
    decisions.value.length > 0 ||
    tasks.value.length > 0 ||
    Boolean(draft.value.transcript?.trim() || draft.value.result);
  if (!hasData) return null;

  function click() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    decisions.setValue([]);
    tasks.setValue([]);
    draft.setValue(EMPTY_DRAFT);
    flash.setValue("");
    setArmed(false);
  }

  return (
    <button
      type="button"
      onClick={click}
      className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
        armed
          ? "border-rose-300 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
          : "border-white/30 text-white hover:bg-white/10"
      }`}
    >
      {armed ? "Click again to wipe everything" : "Reset demo data"}
    </button>
  );
}
