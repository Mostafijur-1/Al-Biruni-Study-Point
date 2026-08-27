"use client";

import Image from "next/image";
import * as React from "react";
import {
  BellRing,
  CheckCircle2,
  Download,
  ExternalLink,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type NotificationState = NotificationPermission | "unsupported";

function getDeviceId() {
  let deviceId = localStorage.getItem("absp_pwa_device_id");
  if (!deviceId) {
    deviceId = window.crypto.randomUUID();
    localStorage.setItem("absp_pwa_device_id", deviceId);
  }
  return deviceId;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [isFirefoxAndroid, setIsFirefoxAndroid] = React.useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = React.useState(false);
  const [notificationPermission, setNotificationPermission] =
    React.useState<NotificationState>("default");
  const [notificationBusy, setNotificationBusy] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState("");

  const subscribeToPushNotifications = React.useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return false;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
      const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const applicationServerKey = Uint8Array.from(rawData, (character) =>
        character.charCodeAt(0),
      );

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const response = await fetch("/api/pwa/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        subscription,
        isInstalledApp:
          window.matchMedia("(display-mode: standalone)").matches ||
          Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone),
      }),
    });

    return response.ok;
  }, []);

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
      setIsInAppBrowser(/FBAN|FBAV|Messenger|Instagram|FB_IAB/i.test(userAgent));
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
    }, 0);

    const deviceId = getDeviceId();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
    }

    if (standalone && !sessionStorage.getItem("absp_pwa_launch_logged")) {
      fetch("/api/pwa/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, type: "launch" }),
      })
        .then(() => sessionStorage.setItem("absp_pwa_launch_logged", "true"))
        .catch((error) => console.error("Error tracking PWA launch:", error));
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setStatusMessage("ABSP অ্যাপ সফলভাবে ইনস্টল হয়েছে।");
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

  React.useEffect(() => {
    if (notificationPermission === "granted") {
      void subscribeToPushNotifications();
    }
  }, [notificationPermission, subscribeToPushNotifications]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setStatusMessage(
      choice.outcome === "accepted"
        ? "ইনস্টলেশন শুরু হয়েছে।"
        : "ইনস্টলেশন বাতিল করা হয়েছে। চাইলে পরে আবার চেষ্টা করতে পারো।",
    );
  };

  const handleNotifications = async () => {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationBusy(true);
    setStatusMessage("");
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        const subscribed = await subscribeToPushNotifications();
        setStatusMessage(
          subscribed
            ? "নোটিফিকেশন চালু হয়েছে। প্রতিদিনের পরীক্ষার রিমাইন্ডার এখানে পাবে।"
            : "অনুমতি দেওয়া হয়েছে, কিন্তু সাবস্ক্রিপশন সম্পন্ন হয়নি। পরে আবার চেষ্টা করো।",
        );
      } else if (permission === "denied") {
        setStatusMessage("ব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি চালু করতে হবে।");
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      setStatusMessage("নোটিফিকেশন চালু করা যায়নি। পরে আবার চেষ্টা করো।");
    } finally {
      setNotificationBusy(false);
    }
  };

  const manualInstall = !isStandalone && !deferredPrompt && (isIos || isFirefoxAndroid);
  const installUnavailable = !isStandalone && !deferredPrompt && !manualInstall;
  const notificationGranted = notificationPermission === "granted";
  const notificationDenied = notificationPermission === "denied";
  const notificationUnsupported = notificationPermission === "unsupported";

  const browserIntentUrl =
    isInAppBrowser && !isIos && typeof window !== "undefined"
      ? `intent://${window.location.host}${window.location.pathname}${window.location.search}#Intent;scheme=https;end`
      : "";

  return (
    <section id="app-access" className="border-y border-border bg-secondary/45 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="overflow-hidden rounded-3xl border border-primary/15 bg-card shadow-[var(--shadow-md)]">
          <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
            <div className="flex flex-col justify-between bg-navy p-6 text-white sm:p-8 lg:p-10">
              <div>
                <div className="flex items-center gap-4">
                  <span className="relative size-20 shrink-0 sm:size-24">
                    <Image src="/absp-logo.png" alt="ABSP" fill sizes="96px" className="object-contain" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-yellow">
                      ABSP Web App
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
                      পড়াশোনা থাকুক হাতের কাছে
                    </h2>
                  </div>
                </div>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
                  অ্যাপ ইনস্টল করলে দ্রুত খুলবে, আর নোটিফিকেশন চালু রাখলে প্রতিদিনের
                  MCQ প্র্যাকটিস পরীক্ষার রিমাইন্ডার সময়মতো পাবে।
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-white/70">
                <ShieldCheck className="size-4 text-brand-yellow" aria-hidden />
                কোনো অ্যাপ স্টোর বা অতিরিক্ত ডাউনলোড দরকার নেই
              </div>
            </div>

            <div className="grid gap-4 p-5 sm:p-7 md:grid-cols-2 lg:p-8">
              {isInAppBrowser && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 md:col-span-2">
                  <p className="font-bold text-amber-950">ডিফল্ট ব্রাউজারে খুলুন</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900/80">
                    Facebook বা Messenger-এর ভেতরের ব্রাউজারে ইনস্টল ও নোটিফিকেশন সীমিত।
                    Chrome বা Safari-তে পেজটি খুলুন।
                  </p>
                  {browserIntentUrl && (
                    <a
                      href={browserIntentUrl}
                      className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-900 px-4 text-sm font-bold text-white"
                    >
                      <ExternalLink className="size-4" aria-hidden />
                      ব্রাউজারে খুলুন
                    </a>
                  )}
                </div>
              )}

              <article className="flex flex-col rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Smartphone className="size-5" aria-hidden />
                  </span>
                  {isStandalone && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="size-3.5" aria-hidden /> ইনস্টল করা
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-black text-primary">ABSP অ্যাপ ইনস্টল</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted">
                  {manualInstall
                    ? isIos
                      ? "Safari-এর Share মেনু থেকে ‘Add to Home Screen’ নির্বাচন করুন।"
                      : "ব্রাউজারের তিন-ডট মেনু থেকে ‘Install’ বা ‘Add to Home Screen’ নির্বাচন করুন।"
                    : "হোম স্ক্রিন থেকে এক ট্যাপে দ্রুত ABSP খুলুন।"
                  }
                </p>
                <Button
                  type="button"
                  variant="navy"
                  className="mt-5 w-full"
                  onClick={handleInstall}
                  disabled={isStandalone || manualInstall || installUnavailable}
                >
                  {isStandalone ? (
                    <><CheckCircle2 className="size-4" /> ইনস্টল করা আছে</>
                  ) : manualInstall ? (
                    "উপরের নির্দেশনা অনুসরণ করুন"
                  ) : installUnavailable ? (
                    "ব্রাউজার ইনস্টল অপশন প্রস্তুত করছে"
                  ) : (
                    <><Download className="size-4" /> এখনই ইনস্টল করুন</>
                  )}
                </Button>
              </article>

              <article className="flex flex-col rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-yellow/20 text-accent-foreground">
                    <BellRing className="size-5" aria-hidden />
                  </span>
                  {notificationGranted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="size-3.5" aria-hidden /> চালু আছে
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-black text-primary">নোটিফিকেশন চালু করুন</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted">
                  {notificationDenied
                    ? "অনুমতি বন্ধ আছে। ব্রাউজার সেটিংস থেকে ABSP-এর নোটিফিকেশন চালু করুন।"
                    : notificationUnsupported
                      ? "এই ব্রাউজারে ওয়েব নোটিফিকেশন সমর্থিত নয়।"
                      : "প্রতিদিনের MCQ প্র্যাকটিস পরীক্ষার রিমাইন্ডার সরাসরি পান।"}
                </p>
                <Button
                  type="button"
                  variant="accent"
                  className={cn("mt-5 w-full", notificationGranted && "bg-emerald-600 text-white")}
                  onClick={handleNotifications}
                  loading={notificationBusy}
                  disabled={notificationGranted || notificationDenied || notificationUnsupported}
                >
                  {notificationGranted ? (
                    <><CheckCircle2 className="size-4" /> নোটিফিকেশন চালু আছে</>
                  ) : notificationDenied ? (
                    "ব্রাউজার সেটিংস ব্যবহার করুন"
                  ) : notificationUnsupported ? (
                    "সমর্থিত নয়"
                  ) : (
                    <><BellRing className="size-4" /> নোটিফিকেশন চালু করুন</>
                  )}
                </Button>
              </article>

              {statusMessage && (
                <p
                  className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary md:col-span-2"
                  role="status"
                  aria-live="polite"
                >
                  {statusMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
