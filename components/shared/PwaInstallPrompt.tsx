"use client";

import * as React from "react";
import { BellRing, CheckCircle2, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPushDeviceId, syncPushSubscription } from "@/lib/push/client-subscription";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type NotificationState = NotificationPermission | "unsupported";

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [isFirefoxAndroid, setIsFirefoxAndroid] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState<NotificationState>("default");
  const [notificationBusy, setNotificationBusy] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");

  React.useEffect(() => {
    const userAgent = navigator.userAgent || "";
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
      document.referrer.includes("android-app://");
    const initializationTimer = window.setTimeout(() => {
      setIsStandalone(standalone);
      setIsIos(/iPhone|iPad|iPod/i.test(userAgent));
      setIsFirefoxAndroid(/Android/i.test(userAgent) && /Firefox/i.test(userAgent));
      setNotificationPermission("Notification" in window ? Notification.permission : "unsupported");
    }, 0);
    const deviceId = getPushDeviceId();
    if (standalone && !sessionStorage.getItem("absp_pwa_launch_logged")) {
      fetch("/api/pwa/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, type: "launch" }),
      }).then(() => sessionStorage.setItem("absp_pwa_launch_logged", "true"))
        .catch((error) => console.error("Error tracking PWA launch:", error));
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setStatusMessage("ABSP অ্যাপ ইনস্টল হয়েছে।");
      fetch("/api/pwa/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, type: "install" }),
      }).catch((error) => console.error("Error tracking PWA install:", error));
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.clearTimeout(initializationTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setStatusMessage(choice.outcome === "accepted" ? "ইনস্টলেশন শুরু হয়েছে।" : "ইনস্টলেশন বাতিল হয়েছে।");
      return;
    }
    if (isIos) {
      setStatusMessage("Safari-এর Share মেনু থেকে ‘Add to Home Screen’ চাপুন।");
    } else if (isFirefoxAndroid) {
      setStatusMessage("ব্রাউজারের মেনু থেকে ‘Install’ বা ‘Add to Home Screen’ চাপুন।");
    } else {
      setStatusMessage("Chrome/ব্রাউজারের মেনু থেকে ‘Install app’ চাপুন।");
    }
  }

  async function handleNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setStatusMessage("এই ব্রাউজারে নোটিফিকেশন সমর্থিত নয়।");
      return;
    }
    setNotificationBusy(true);
    setStatusMessage("");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        const subscribed = await syncPushSubscription();
        setStatusMessage(subscribed ? "দৈনিক পরীক্ষার নোটিফিকেশন চালু হয়েছে।" : "অনুমতি হয়েছে, কিন্তু সাবস্ক্রিপশন সম্পন্ন হয়নি।");
      } else if (permission === "denied") {
        setStatusMessage("ব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি চালু করুন।");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setStatusMessage("নোটিফিকেশন চালু করা যায়নি। পরে আবার চেষ্টা করুন।");
    } finally {
      setNotificationBusy(false);
    }
  }

  const notificationGranted = notificationPermission === "granted";
  const notificationUnavailable = notificationPermission === "denied" || notificationPermission === "unsupported";

  return (
    <div className="mt-6 max-w-md">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Button
          type="button"
          size="default"
          variant="accent"
          className="min-h-12 w-full border-2 border-brand-yellow bg-brand-yellow px-4 text-sm font-bold text-navy shadow-[0_6px_18px_rgba(0,0,0,0.24)] hover:border-white hover:bg-white hover:text-navy focus-visible:ring-brand-yellow focus-visible:ring-offset-navy disabled:border-white/60 disabled:bg-white/90 disabled:text-navy disabled:opacity-100"
          onClick={() => void handleInstall()}
          disabled={isStandalone}
        >
          {isStandalone ? <><CheckCircle2 className="size-5" /> App installed</> : <><Download className="size-5" /> Install app</>}
        </Button>
        <Button
          type="button"
          size="default"
          variant="outline"
          className="min-h-12 w-full border-2 border-white bg-white px-4 text-sm font-bold text-navy shadow-[0_6px_18px_rgba(0,0,0,0.24)] hover:border-brand-yellow hover:bg-brand-yellow hover:text-navy focus-visible:ring-white focus-visible:ring-offset-navy disabled:border-white/70 disabled:bg-white/90 disabled:text-navy disabled:opacity-100"
          onClick={() => void handleNotifications()}
          loading={notificationBusy}
          disabled={notificationGranted || notificationUnavailable}
        >
          {notificationGranted ? <><CheckCircle2 className="size-5" /> Notifications on</> : <><BellRing className="size-5" /> Enable notifications</>}
        </Button>
      </div>
      {statusMessage && <p className="mt-2 text-xs leading-5 text-white/70" role="status" aria-live="polite">{statusMessage}</p>}
    </div>
  );
}
