import type { StoredDecision, Task } from "./types";

export const STORAGE_KEYS = {
  decisions: "mta.decisions",
  tasks: "mta.tasks",
  draft: "mta.draft",
  flash: "mta.flash",
} as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadDecisions(): StoredDecision[] {
  return readJson<StoredDecision[]>(STORAGE_KEYS.decisions, []);
}

export function saveDecisions(decisions: StoredDecision[]) {
  writeJson(STORAGE_KEYS.decisions, decisions);
}

export function loadTasks(): Task[] {
  return readJson<Task[]>(STORAGE_KEYS.tasks, []);
}

export function saveTasks(tasks: Task[]) {
  writeJson(STORAGE_KEYS.tasks, tasks);
}
