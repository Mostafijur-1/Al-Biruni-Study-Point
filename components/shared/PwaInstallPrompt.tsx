"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Bell, Download, X, Smartphone, Compass, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const params = useParams();
  const locale = params?.locale as string;
  const isBengali = locale === "bn";

  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState<string>("default");
  const [isMobile, setIsMobile] = React.useState(false);
  
  // In-app browser detection state
  const [isInAppBrowser, setIsInAppBrowser] = React.useState(false);
  const [isFbPromptVisible, setIsFbPromptVisible] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);

  // Localized texts
  const t = {
    title: isBengali ? "ABSP অ্যাপ ইনস্টল করুন" : "Install ABSP App",
    desc: isBengali
      ? "দ্রুত MCQ পরীক্ষা ও ক্লাসের আপডেট পেতে আমাদের অফিশিয়াল অ্যাপটি ইনস্টল করুন।"
      : "Install Al-Biruni Study Point on your device for instant access, classes, and study alerts.",
    installBtn: isBengali ? "ইনস্টল করুন" : "Install App",
    dismissBtn: isBengali ? "পরে" : "Later",
    notifTitle: isBengali ? "নোটিফিকেশন চালু করুন" : "Enable Alerts",
    notifDesc: isBengali
      ? "ক্লাস এবং পরীক্ষার নোটিফিকেশন সরাসরি ফোনে পেতে চান?"
      : "Get real-time updates and class reminders directly on your phone.",
    allowNotif: isBengali ? "চালু করুন" : "Enable Notifications",
    inAppTitle: isBengali ? "ব্রাউজারে ওপেন করুন" : "Open in Default Browser",
    inAppDescAndroid: isBengali
      ? "সম্পূর্ণ ফিচার, ইনস্টলেশন ও নোটিফিকেশন পেতে অ্যাপটি ক্রোম ব্রাউজারে ওপেন করুন।"
      : "Open this page in Google Chrome to install the app and enable alerts.",
    inAppDescIos: isBengali
      ? "অ্যাপটি ইনস্টল করতে নিচের শেয়ার বা ৩-ডট আইকন চেপে 'Open in Safari' সিলেক্ট করুন।"
      : "To install the app, tap the share or '...' button and select 'Open in Safari'.",
    openChromeBtn: isBengali ? "ক্রোমে ওপেন করুন" : "Open in Chrome",
  };

  React.useEffect(() => {
    // Check if device is mobile by user-agent or viewport size
    const mobileDevice =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.matchMedia("(max-width: 768px)").matches;
    setIsMobile(mobileDevice);

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    
    // Detect In-App browser (Facebook, Messenger, Instagram)
    const isFb = /FBAN|FBAV|Messenger|Instagram|FB_IAB/i.test(ua);
    setIsInAppBrowser(isFb);

    // Detect iOS device
    const iosDevice = /iPhone|iPad|iPod/i.test(ua);
    setIsIos(iosDevice);

    if (isFb) {
      setIsFbPromptVisible(true);
    }

    // Generate or retrieve unique deviceId
    let deviceId = localStorage.getItem("absp_pwa_device_id");
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("absp_pwa_device_id", deviceId);
    }

    // 1. Check if app is already running in standalone mode (already installed/PWA)
    const isPwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");
    setIsStandalone(isPwa);

    // Track standalone launch
    if (isPwa) {
      const launchLogged = sessionStorage.getItem("absp_pwa_launch_logged");
      if (!launchLogged) {
        fetch("/api/pwa/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, type: "launch" }),
        })
          .then(() => {
            sessionStorage.setItem("absp_pwa_launch_logged", "true");
          })
          .catch((err) => console.error("Error tracking PWA launch:", err));
      }
    }

    // 2. Check current Notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "granted") {
        subscribeToPushNotifications();
      }
    }

    // 3. Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered successfully with scope:", reg.scope);
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
        });
    }

    // 4. Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    // 5. Listen for appinstalled event
    const handleAppInstalled = () => {
      fetch("/api/pwa/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, type: "install" }),
      }).catch((err) => console.error("Error tracking PWA install:", err));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleDismissFb = () => {
    setIsFbPromptVisible(false);
  };

  const subscribeToPushNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        return;
      }

      if (!subscription) {
        const padding = "=".repeat((4 - (vapidPublicKey.length % 4)) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: outputArray,
        });
      }

      const deviceId = localStorage.getItem("absp_pwa_device_id");
      const isInstalled = window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone;

      await fetch("/api/pwa/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          subscription,
          isInstalledApp: isInstalled,
        }),
      });
    } catch (err) {
      console.error("Error subscribing to push notifications:", err);
    }
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("Notifications not supported on your browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
        await subscribeToPushNotifications();
        new Notification(isBengali ? "অভিনন্দন!" : "Awesome!", {
          body: isBengali
            ? "ABSP থেকে এখন আপনি সকল প্রয়োজনীয় নোটিফিকেশন সরাসরি পাবেন।"
            : "You will now receive exam updates and alerts directly from ABSP.",
          icon: "/icon.png",
        });
      }
    } catch (error) {
      console.error("Error requesting notification permission", error);
    }
  };

  // If not a mobile device, do not render any prompts
  if (!isMobile) {
    return null;
  }

  // If inside Facebook/Messenger/Instagram in-app browser, show open in default browser guide
  if (isInAppBrowser) {
    if (!isFbPromptVisible) {
      return null;
    }

    // Generate Chrome intent link for Android
    let chromeIntentUrl = "";
    if (!isIos && typeof window !== "undefined") {
      const urlWithoutProtocol = window.location.host + window.location.pathname + window.location.search;
      chromeIntentUrl = `intent://${urlWithoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
    }

    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-in rounded-xl border border-border bg-card/90 p-4 text-card-foreground shadow-lg backdrop-blur-md transition-all duration-300 md:bottom-6 md:right-6 md:left-auto md:mx-0">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue dark:bg-brand-blue dark:text-white">
                <Compass className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">{t.inAppTitle}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {isIos ? t.inAppDescIos : t.inAppDescAndroid}
                </p>
              </div>
            </div>
            <button
              onClick={handleDismissFb}
              className="rounded-full p-1 text-muted hover:bg-secondary hover:text-primary transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
          {!isIos && (
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleDismissFb}>
                {t.dismissBtn}
              </Button>
              <a href={chromeIntentUrl}>
                <Button variant="accent" size="sm" className="gap-1.5">
                  <ExternalLink className="size-4" />
                  {t.openChromeBtn}
                </Button>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If already standalone (installed) and notification is granted (or denied, so we shouldn't ask), do not show anything
  if (isStandalone && notificationPermission !== "default") {
    return null;
  }

  // Determine what type of prompt to show
  // If not installed and PWA prompt is ready, show installation prompt
  // Else if installed but notification permission is still default, show request notification banner
  const showInstall = isVisible && deferredPrompt;
  const showNotificationRequest = isStandalone && notificationPermission === "default";

  if (!showInstall && !showNotificationRequest) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-in rounded-xl border border-border bg-card/90 p-4 text-card-foreground shadow-lg backdrop-blur-md transition-all duration-300 md:bottom-6 md:right-6 md:left-auto md:mx-0">
      {showInstall ? (
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue dark:bg-brand-blue dark:text-white">
                <Smartphone className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">{t.title}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">{t.desc}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-full p-1 text-muted hover:bg-secondary hover:text-primary transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              {t.dismissBtn}
            </Button>
            <Button variant="accent" size="sm" className="gap-1.5" onClick={handleInstallClick}>
              <Download className="size-4" />
              {t.installBtn}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue dark:bg-brand-blue dark:text-white">
                <Bell className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">{t.notifTitle}</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">{t.notifDesc}</p>
              </div>
            </div>
            <button
              onClick={() => setNotificationPermission("dismissed")}
              className="rounded-full p-1 text-muted hover:bg-secondary hover:text-primary transition-colors"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setNotificationPermission("dismissed")}>
              {t.dismissBtn}
            </Button>
            <Button variant="navy" size="sm" className="gap-1.5" onClick={requestNotificationPermission}>
              <Bell className="size-4" />
              {t.allowNotif}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
