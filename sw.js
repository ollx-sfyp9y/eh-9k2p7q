/* 入境小幫手 service worker — 離線快取
   VERSION 由 tools/build_audio.py 自動改寫；改版後瀏覽器會自動更新快取 */
const VERSION = 'v-4b1d180386';
const CACHE = `entry-helper-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const res = await fetch(`precache.json?v=${VERSION}`);
    const { files } = await res.json();
    const existedBefore = await caches.has(CACHE); // 同名快取已在使用中就不能因失敗刪掉它
    const cache = await caches.open(CACHE);
    const failed = [];
    for (const f of files) {
      try { await cache.add(new Request(f, { cache: 'no-cache' })); } catch (err) { failed.push(f); }
    }
    if (failed.length) {
      // 下載不完整就放棄這次安裝，保住舊版完整快取；下次打開會自動重試
      if (!existedBefore) await caches.delete(CACHE);
      throw new Error(`precache incomplete: ${failed.length} files`);
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith('entry-helper-') && k !== CACHE) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // AI 請求等外部流量不經手、不快取
  e.respondWith((async () => {
    const cached = await caches.match(e.request, { ignoreSearch: url.pathname.endsWith('precache.json') ? false : true });
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
