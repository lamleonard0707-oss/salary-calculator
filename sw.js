const CACHE_NAME = 'salary-calc-v8';
const ASSETS = ['/', 'index.html', 'style.css', 'app.js', 'manifest.json'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            // 即刻接管已經開住嘅頁，唔使閂晒個 app 先食到新版
            .then(() => self.clients.claim())
    );
});

// Network-first：有網一定攞最新，冇網先用 cache（唔會再卡死喺舊版）
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    e.respondWith(
        fetch(e.request)
            .then(resp => {
                if (resp && resp.ok) {
                    const copy = resp.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
                }
                return resp;
            })
            .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
    );
});
