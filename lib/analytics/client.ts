import type { StudentEventName } from "@/lib/db/models/ProductEvent";

type StudentEventProperties = Record<string, string | number | boolean>;

type QueuedStudentEvent = {
  name: StudentEventName;
  surface: string;
  properties?: StudentEventProperties;
};

const MAX_BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 750;
const eventQueue: QueuedStudentEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let unloadListenerRegistered = false;

export function trackStudentEvent(
  name: StudentEventName,
  surface: string,
  properties?: StudentEventProperties,
) {
  eventQueue.push({ name, surface, properties });
  registerUnloadListener();

  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushStudentEvents();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flushStudentEvents, FLUSH_DELAY_MS);
  }
}

function flushStudentEvents() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (eventQueue.length === 0) return;

  const events = eventQueue.splice(0, MAX_BATCH_SIZE);
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(events),
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt a student's learning flow.
  });

  if (eventQueue.length > 0) {
    flushTimer = setTimeout(flushStudentEvents, FLUSH_DELAY_MS);
  }
}

function registerUnloadListener() {
  if (unloadListenerRegistered || typeof window === "undefined") return;
  window.addEventListener("pagehide", flushStudentEvents);
  unloadListenerRegistered = true;
}
