"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { writeJson } from "./storage";

const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  const set = listeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

function subscribeToKey(key: string, onStoreChange: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set!.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

const emptySubscribe = () => () => {};

// Returns the SAME object reference until the stored string actually changes.
const snapshotCache = new Map<string, { raw: string | null; value: unknown }>();

function getCachedSnapshot<T>(key: string, initial: T): T {
  if (typeof window === "undefined") return initial;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return initial;
  }

  const hit = snapshotCache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;

  let value: T = initial;
  try {
    value = raw === null ? initial : (JSON.parse(raw) as T);
  } catch {
    value = initial;
  }
  snapshotCache.set(key, { raw, value });
  return value;
}

export function useLocalStorage<T>(key: string, initial: T) {
  // Keep `initial` stable even if the caller passes a new [] or {} every render.
  const initialRef = useRef(initial);

  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeToKey(key, onStoreChange),
    [key],
  );

  const getSnapshot = useCallback(
    () => getCachedSnapshot<T>(key, initialRef.current),
    [key],
  );

  const getServerSnapshot = useCallback(() => initialRef.current, []);

  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (update: T | ((prev: T) => T)) => {
      const prev = getCachedSnapshot<T>(key, initialRef.current);
      const next =
        typeof update === "function" ? (update as (value: T) => T)(prev) : update;
      writeJson(key, next);
      emit(key);
    },
    [key],
  );

  return {
    value: hydrated ? stored : initialRef.current,
    setValue,
    ready: hydrated,
  };
}