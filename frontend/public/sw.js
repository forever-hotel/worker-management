/* WKMS public-only PWA cache. Never cache authenticated task or API data. */
const PUBLIC_CACHE = 'wkms-public-pwa-v2';
const PUBLIC_CACHE_PREFIX = 'wkms-public-pwa-';
const OFFLINE_PAGE = '/offline.html';

const OPTIONAL_PUBLIC_ASSETS = [
  '/icons/wkms-192.png',
  '/icons/wkms-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PUBLIC_CACHE);

    await cache.add(OFFLINE_PAGE);

    await Promise.allSettled(
      OPTIONAL_PUBLIC_ASSETS.map((path) => cache.add(path))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter(
          (name) =>
            name.startsWith(PUBLIC_CACHE_PREFIX) &&
            name !== PUBLIC_CACHE
        )
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

function isPublicStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/images/tasks/')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (
    request.method !== 'GET' ||
    request.headers.has('authorization')
  ) {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (
          (await caches.match(OFFLINE_PAGE)) ||
          Response.error()
        );
      }
    })());

    return;
  }

  if (!isPublicStaticAsset(url.pathname)) {
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(PUBLIC_CACHE);
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    const response = await fetch(request);

    if (response.ok && response.type === 'basic') {
      event.waitUntil(
        cache.put(request, response.clone())
          .catch(() => undefined)
      );
    }

    return response;
  })());
});
