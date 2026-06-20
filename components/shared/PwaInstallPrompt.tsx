"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Bell, Download, X, Smartphone, Compass, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/hooks/use-session";

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

  const { user, checking } = useSession({ listenToAuthChanges: true });

  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState<string>("default");
  const [isMobile, setIsMobile] = React.useState(false);
  
  // In-app browser detection state
  const [isInAppBrowser, setIsInAppBrowser] = React.useState(false);
  const [isFbPromptVisible, setIsFbPromptVisible] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);
  const [isFirefoxAndroid, setIsFirefoxAndroid] = React.useState(false);

  // Localized texts
  const t = {
    title: isBengali ? "ABSP অ্যাপ ইনস্টল করুন" : "Install ABSP App",
    desc: isBengali
      ? "দ্রুত MCQ পরীক্ষা ও ক্লাসের আপডেট পেতে আমাদের অফিশিয়াল অ্যাপটি ইনস্টল করুন।"
      : "Install Al-Biruni Study Point on your device for instant access, classes, and study alerts.",
    iosInstallDesc: isBengali
      ? "অ্যাপটি ইনস্টল করতে শেয়ার বাটন চেপে 'Add to Home Screen' (বা হোম স্ক্রিনে যোগ করুন) সিলেক্ট করুন।"
      : "To install the app, tap the Share button and select 'Add to Home Screen'.",
    firefoxInstallDesc: isBengali
      ? "অ্যাপটি ইনস্টল করতে ৩-ডট মেনু চেপে 'Install' (বা হোম স্ক্রিনে যোগ করুন) সিলেক্ট করুন।"
      : "To install the app, tap the 3-dot menu and select 'Install' or 'Add to Home Screen'.",
    installBtn: isBengali ? "ইনস্টল করুন" : "Install App",
    dismissBtn: isBengali ? "পরে" : "Later",
    notifTitle: isBengali ? "নোটিফিকেশন চালু করুন" : "Enable Alerts",
    notifDesc: isBengali
      ? "ক্লাস এবং পরীক্ষার নোটিফিকেশন সরাসরি ফোনে পেতে চান?"
      : "Get real-time updates and class reminders directly on your phone.",
    allowNotif: isBengali ? "চালু করুন" : "Enable Notifications",
    inAppTitle: isBengali ? "ব্রাউজারে ওপেন করুন" : "Open in Default Browser",
    inAppDescAndroid: isBengali
      ? "সম্পূর্ণ ফিচার, ইনস্টলেশন ও নোটিফিকেশন পেতে অ্যাপটি আপনার ডিফল্ট ব্রাউজারে (যেমন ক্রোম, এজ, ফায়ারফক্স) ওপেন করুন।"
      : "Open this page in your default browser (like Chrome, Edge, Firefox) to install the app and enable alerts.",
    inAppDescIos: isBengali
      ? "অ্যাপটি ইনস্টল করতে নিচের শেয়ার বা ৩-ডট আইকন চেপে 'Open in Safari' সিলেক্ট করুন।"
      : "To install the app, tap the share or '...' button and select 'Open in Safari'.",
    openBrowserBtn: isBengali ? "ব্রাউজারে ওপেন করুন" : "Open in Browser",
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

    // Detect Android Firefox
    const firefoxAndroid = /Android/i.test(ua) && /Firefox/i.test(ua);
    setIsFirefoxAndroid(firefoxAndroid);

    const fbDismissed = sessionStorage.getItem("absp_pwa_fb_dismissed");
    if (isFb && !fbDismissed) {
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

    // If it's iOS or Firefox on Android, and not running in standalone mode,
    // we can show the manual installation guide if not dismissed in this session.
    const dismissed = sessionStorage.getItem("absp_pwa_dismissed");
    if ((iosDevice || firefoxAndroid) && !isPwa && !dismissed) {
      setIsVisible(true);
    }

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

    // 2. Check current Notification permission (moved to a separate useEffect relying on session user role)

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
      
      // Only show if not dismissed in this session
      const dismissedPrompt = sessionStorage.getItem("absp_pwa_dismissed");
      if (!dismissedPrompt) {
        setIsVisible(true);
      }
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

  // Check notification permission and subscribe once the session has finished loading and if not a teacher
  React.useEffect(() => {
    if (checking) return;
    if (user?.role === "teacher") return;

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === "granted") {
        subscribeToPushNotifications();
      }
    }
  }, [checking, user]);

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
    sessionStorage.setItem("absp_pwa_dismissed", "true");
  };

  const handleDismissFb = () => {
    setIsFbPromptVisible(false);
    sessionStorage.setItem("absp_pwa_fb_dismissed", "true");
  };

  const subscribeToPushNotifications = async () => {
    if (checking || user?.role === "teacher") {
      return;
    }
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
    if (checking || user?.role === "teacher") {
      return;
    }
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

    // Generate default browser intent link for Android
    let defaultBrowserIntentUrl = "";
    if (!isIos && typeof window !== "undefined") {
      const urlWithoutProtocol = window.location.host + window.location.pathname + window.location.search;
      defaultBrowserIntentUrl = `intent://${urlWithoutProtocol}#Intent;scheme=https;end`;
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
              <a href={defaultBrowserIntentUrl}>
                <Button variant="accent" size="sm" className="gap-1.5">
                  <ExternalLink className="size-4" />
                  {t.openBrowserBtn}
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
  // If not installed and PWA prompt is ready or we are on iOS/Firefox Android, show installation prompt
  // Else if installed but notification permission is still default, show request notification banner
  const showInstall = isVisible && (deferredPrompt || isIos || isFirefoxAndroid);
  const showNotificationRequest = isStandalone && notificationPermission === "default" && !checking && user?.role !== "teacher";

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
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  {deferredPrompt
                    ? t.desc
                    : isIos
                    ? t.iosInstallDesc
                    : t.firefoxInstallDesc}
                </p>
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
            {deferredPrompt ? (
              <Button variant="accent" size="sm" className="gap-1.5" onClick={handleInstallClick}>
                <Download className="size-4" />
                {t.installBtn}
              </Button>
            ) : (
              <Button variant="accent" size="sm" onClick={handleDismiss}>
                {isBengali ? "বুঝতে পেরেছি" : "Got it"}
              </Button>
            )}
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
