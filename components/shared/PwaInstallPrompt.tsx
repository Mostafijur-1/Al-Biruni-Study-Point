"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Bell, Download, X, Smartphone } from "lucide-react";
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

  // Localized texts
  const t = {
    title: isBengali ? "মোবাইলে ABSP অ্যাপ ইনস্টল করুন" : "Install ABSP App",
    desc: isBengali
      ? "দ্রুত MCQ পরীক্ষা ও ক্লাসের আপডেট পেতে আমাদের অফিশিয়াল অ্যাপটি ইনস্টল করুন।"
      : "Install Al-Biruni Study Point on your device for instant access, classes, and study alerts.",
    installBtn: isBengali ? "অ্যাপটি নামান" : "Install App",
    dismissBtn: isBengali ? "পরে" : "Later",
    notifTitle: isBengali ? "নোটিফিকেশন চালু করুন" : "Enable Alerts",
    notifDesc: isBengali
      ? "ক্লাস এবং পরীক্ষার নোটিফিকেশন সরাসরি ফোনে পেতে চান?"
      : "Get real-time updates and class reminders directly on your phone.",
    allowNotif: isBengali ? "চালু করুন" : "Enable Notifications",
  };

  React.useEffect(() => {
    // Check if device is mobile by user-agent or viewport size
    const mobileDevice =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.matchMedia("(max-width: 768px)").matches;
    setIsMobile(mobileDevice);

    // 1. Check if app is already running in standalone mode (already installed/PWA)
    const isPwa =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes("android-app://");
    setIsStandalone(isPwa);

    // 2. Check current Notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
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

      // Check if user dismissed it recently (cooldown check: 2 days)
      const lastDismissed = localStorage.getItem("pwa-prompt-dismissed-at");
      const twoDays = 2 * 24 * 60 * 60 * 1000;
      if (!lastDismissed || Date.now() - parseInt(lastDismissed, 10) > twoDays) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
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
    // Set timestamp of dismissal to prevent annoying the user
    localStorage.setItem("pwa-prompt-dismissed-at", Date.now().toString());
  };

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert(isBengali ? "আপনার ব্রাউজার পুশ নোটিফিকেশন সাপোর্ট করে না।" : "Notifications not supported on your browser.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === "granted") {
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
