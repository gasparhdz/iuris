const CACHE_NAME = "iuris-cache-v2";
const BASE_PATH = "/";
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}icons/icon.png`,
  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`,
  `${BASE_PATH}icons/logo.png`,
];

const STATIC_ASSET_PATTERN = /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|svg|gif|webp|ico)$/i;
const AUTH_PATTERN = /\/(?:auth|login|logout|token|refresh-token|forgot-password|reset-password)(?:\/|$)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

const isApiRequest = (url) => (
  url.origin === self.location.origin
  && (
    url.pathname.startsWith(`${BASE_PATH}api/v1/`)
    || url.pathname.startsWith(`${BASE_PATH}api/`)
    || url.pathname.startsWith("/api/v1/")
  )
);

const isAuthRequest = (url) => (
  url.origin === self.location.origin
  && AUTH_PATTERN.test(url.pathname)
);

const isStaticAsset = (request, url) => (
  request.method === "GET"
  && url.origin === self.location.origin
  && url.pathname.startsWith(BASE_PATH)
  && STATIC_ASSET_PATTERN.test(url.pathname)
);

const cacheFirst = async (request) => {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
};

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
};

const navigationFallback = async (request) => {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(BASE_PATH, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return caches.match(BASE_PATH);
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (isAuthRequest(url)) {
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.mode === "navigate" && url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Iuris",
    body: "",
    url: BASE_PATH,
    tag: "iuris-notification",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || payload.body,
        url: parsed.url || payload.url,
        tag: parsed.tag || payload.tag,
      };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { url: payload.url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || BASE_PATH;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus().then((focusedClient) => {
            if ("navigate" in focusedClient) {
              return focusedClient.navigate(targetUrl);
            }
            return focusedClient;
          });
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
