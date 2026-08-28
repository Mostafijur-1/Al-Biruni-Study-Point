"use client";

import * as React from "react";

import { syncPushSubscription } from "@/lib/push/client-subscription";

export function PushNotificationSync() {
  React.useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    void syncPushSubscription().catch((error) => {
      console.error("Push subscription synchronization failed", error);
    });
  }, []);

  return null;
}
