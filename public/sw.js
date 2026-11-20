const name = "depup-office-v4";
const shell = ["/", "/office/"];
const allowed = (url) => url.origin === self.location.origin
  && (url.pathname === "/qpdf-worker.js" || ["/_next/static/", "/runtime/", "/brand/"].some((prefix) => url.pathname.startsWith(prefix)));

self.addEventListener("install", (event) => event.waitUntil(caches.open(name).then(async (cache) => {
  await cache.addAll([...shell, "/brand/depup-mark.png", "/manifest.webmanifest"]);
  const resources = new Set([
    "/brand/inter-tight-latin.woff2", "/brand/glass-pages-480.webp", "/brand/glass-pages-880.webp",
    "/brand/workspace-desktop.webp", "/brand/workspace-mobile.webp",
  ]);
  for (const route of shell) {
    const html = await (await cache.match(route)).text();
    for (const [, asset] of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) resources.add(asset);
  }
  await cache.addAll([...resources]);
})));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("depup-office-") && key !== name).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener("message", (event) => {
  const urls = event.data?.resources;
  if (!Array.isArray(urls)) return;
  event.waitUntil(caches.open(name).then((cache) => Promise.allSettled(urls.filter((url) => allowed(new URL(url))).map((url) => cache.add(url)))));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && shell.includes(url.pathname)) {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) await (await caches.open(name)).put(url.pathname, response.clone()).catch(() => {});
      return response;
    }).catch(() => caches.match(url.pathname)));
  } else if (allowed(url) && !request.headers.has("Range")) {
    event.respondWith(caches.open(name).then(async (cache) => {
      const existing = await cache.match(request);
      if (existing && !url.pathname.startsWith("/runtime/")) return existing;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone()).catch(() => {});
        return response;
      } catch (error) {
        if (existing) return existing;
        throw error;
      }
    }));
  }
});
