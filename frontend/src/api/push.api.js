import api from "./axios";

const unwrap = (response) => response.data?.data ?? response.data;

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function isPushSupported() {
  return (
    typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
  );
}

export async function getPushPublicKey() {
  return unwrap(await api.get("/notificaciones/push/vapid-public-key"));
}

export async function subscribePush(subscriptionJSON) {
  return unwrap(await api.post("/notificaciones/push/subscribe", {
    endpoint: subscriptionJSON.endpoint,
    keys: {
      p256dh: subscriptionJSON.keys.p256dh,
      auth: subscriptionJSON.keys.auth,
    },
  }));
}

export async function unsubscribePush(endpoint) {
  return unwrap(await api.post("/notificaciones/push/unsubscribe", { endpoint }));
}

export async function getPushStatus() {
  const supported = isPushSupported();
  const permission = supported ? Notification.permission : "unsupported";

  let subscribed = false;
  if (supported && permission === "granted") {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        subscribed = Boolean(subscription);
      }
    } catch {
      subscribed = false;
    }
  }

  return { supported, permission, subscribed };
}

export async function enablePush() {
  if (!isPushSupported()) {
    throw new Error("PUSH_NOT_SUPPORTED");
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (!existingRegistration) {
    throw new Error("PUSH_NO_SERVICE_WORKER");
  }

  const registration = await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("PUSH_PERMISSION_DENIED");
  }

  const { publicKey, enabled } = await getPushPublicKey();
  if (!enabled || !publicKey) {
    throw new Error("PUSH_SERVER_DISABLED");
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await subscribePush(subscription.toJSON());

  return subscription;
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return;
  }

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  const { endpoint } = subscription;
  await unsubscribePush(endpoint);
  await subscription.unsubscribe();
}
