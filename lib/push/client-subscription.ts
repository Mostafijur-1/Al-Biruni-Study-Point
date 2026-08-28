export function getPushDeviceId() {
  let deviceId = localStorage.getItem("absp_pwa_device_id");
  if (!deviceId) {
    deviceId = window.crypto.randomUUID();
    localStorage.setItem("absp_pwa_device_id", deviceId);
  }
  return deviceId;
}

function decodeVapidPublicKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
}

function hasCurrentApplicationServerKey(
  subscription: PushSubscription,
  expectedKey: Uint8Array<ArrayBuffer>,
) {
  const configuredKey = subscription.options.applicationServerKey;
  if (!configuredKey) return false;

  const actualKey = new Uint8Array(configuredKey);
  return actualKey.length === expectedKey.length &&
    actualKey.every((value, index) => value === expectedKey[index]);
}

export async function syncPushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapidPublicKey) return false;

  await navigator.serviceWorker.register("/sw.js");
  const applicationServerKey = decodeVapidPublicKey(vapidPublicKey);
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  // Browsers retain subscriptions created with an old VAPID key. Replace
  // those subscriptions so the current server key pair can deliver pushes.
  if (subscription && !hasCurrentApplicationServerKey(subscription, applicationServerKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const response = await fetch("/api/pwa/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deviceId: getPushDeviceId(),
      subscription,
      isInstalledApp:
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone),
    }),
  });

  return response.ok;
}
