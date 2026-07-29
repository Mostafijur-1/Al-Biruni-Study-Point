import type { StudentEventName } from "@/lib/db/models/ProductEvent";

type StudentEventProperties = Record<string, string | number | boolean>;

export function trackStudentEvent(
  name: StudentEventName,
  surface: string,
  properties?: StudentEventProperties,
) {
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, surface, properties }),
    cache: "no-store",
    keepalive: true,
  }).catch(() => {
    // Analytics must never interrupt a student's learning flow.
  });
}
