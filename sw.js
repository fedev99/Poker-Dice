const CACHE_NAME = 'poker-dice-cache-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-poker.svg',
  './icon-poker-192.png',
  './icon-poker-512.png',
  './screenshot.png'
];
const DEPENDENCY_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@600;800;900&family=Inter:wght@400;500;600;700&display=swap'
];
const APP_SHELL = new URL('./index.html', self.registration.scope).href;
const SUPABASE_HOST = 'zfslvhfkzbpzokqbfepe.supabase.co';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all([...CORE_ASSETS, ...DEPENDENCY_ASSETS].map(async asset => {
      try {
        const isExternal = new URL(asset, self.registration.scope).origin !== self.location.origin;
        const request = new Request(asset, { mode: isExternal ? 'no-cors' : 'same-origin' });
        const response = await fetch(request);
        if (!response.ok && response.type !== 'opaque') {
          throw new Error(`HTTP ${response.status}`);
        }
        await cache.put(request, response);
      } catch (error) {
        console.warn(`Impossibile mettere in cache ${asset}:`, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(cacheName => cacheName.startsWith('poker-dice-cache-') && cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.hostname === SUPABASE_HOST) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return await caches.match(request) || await caches.match(APP_SHELL);
      }
    })());
    return;
  }

  const isAppAsset = requestUrl.origin === self.location.origin;
  const isExternalDependency = ['script', 'style', 'font'].includes(request.destination);
  if (!isAppAsset && !isExternalDependency) return;

  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);
    if (isAppAsset && cachedResponse) return cachedResponse;

    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      } else if (cachedResponse) {
        return cachedResponse;
      }
      return response;
    } catch (error) {
      if (cachedResponse) return cachedResponse;
      throw error;
    }
  })());
});
