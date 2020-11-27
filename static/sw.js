const appId = 'com.codingclip.clipcc3';
const appVer = '2020101101';

const cacheName = appId + '@' + appVer;
const cacheList = global.serviceWorkerOption.assets;

self.addEventListener('install', event => {
    console.log('[Service Worker] Event: install');
    event.waitUntil(
        caches.open(cacheName).then(cache => {
            return cache.addAll(cacheList);
        })
    );
});

self.addEventListener('fetch', event => {
    console.log('[Service Worker] Event: fetch');
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                console.log('[Service Workder] Debug: ', response);
                return response;
            }
            return fetch(event.request);
        })
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Workder] Event: activate');
    const cacheWhitelist = [cacheName];
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheWhitelist.indexOf(cacheName) === -1) {
                    return caches.delete(cacheName);
                }
                return '';
            })
        ))
    );
});
