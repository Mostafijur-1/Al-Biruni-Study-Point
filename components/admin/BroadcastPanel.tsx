"use client";

import { useState } from "react";
import { Send, Bell, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { apiFetch, getApiErrorMessage, isApiSuccess } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type BroadcastResponse = {
  message: string;
  count: number;
};

export function BroadcastPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [targetAudience, setTargetAudience] = useState("all"); // 'all' | 'pwa-only'
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatus({ type: "error", text: "Message is required." });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const { ok, payload } = await apiFetch<BroadcastResponse>("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          message: message.trim(),
          targetClass: targetClass || undefined,
          targetAudience,
        }),
      });

      if (ok && isApiSuccess(payload)) {
        setStatus({
          type: "success",
          text: payload.data.message || `Broadcast sent successfully!`,
        });
        // Clear fields on success
        setTitle("");
        setMessage("");
      } else {
        setStatus({
          type: "error",
          text: getApiErrorMessage(payload, "Could not send broadcast notification."),
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: "An unexpected error occurred while sending the broadcast.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/10">
          <Bell className="size-5 text-primary animate-pulse" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-primary">Push Broadcast Announcements</h2>
          <p className="text-xs text-muted">Send real-time alerts directly to students' devices via Web Push.</p>
        </div>
      </div>

      <form onSubmit={handleSend} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Target Audience */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-accent mb-1.5">Target Audience</label>
            <select
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="all">All Subscribed Devices</option>
              <option value="pwa-only">PWA Installed App Users Only</option>
            </select>
          </div>

          {/* Target Class */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-accent mb-1.5">Target Class</label>
            <select
              value={targetClass}
              onChange={(e) => setTargetClass(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">All Classes</option>
              <option value="class-9">Class 9</option>
              <option value="class-10">Class 10</option>
              <option value="class-11">Class 11</option>
              <option value="class-12">Class 12</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-accent mb-1.5">Notification Title (Optional)</label>
          <input
            type="text"
            placeholder="e.g. নতুন পরীক্ষার নোটিশ"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-accent mb-1.5">Notification Message</label>
          <textarea
            rows={3}
            placeholder="বিজ্ঞপ্তি বা বার্তার বিস্তারিত এখানে লিখুন..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            required
          />
        </div>

        {/* Status messages */}
        {status && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3.5 text-sm",
              status.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50/80 text-red-800"
            )}
          >
            {status.type === "success" ? (
              <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-red-600" />
            )}
            <p className="leading-snug">{status.text}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Send Broadcast
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
