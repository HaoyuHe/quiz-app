/**
 * Service Worker - PWA 离线缓存
 * v3 - 不预缓存JS文件，避免缓存旧代码
 */

const CACHE_NAME = 'quiz-app-v3';

// 安装事件 - 只缓存静态资源，不缓存JS
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('SW v3 安装完成');
        // 不预缓存任何JS文件，全部走网络
      })
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理所有旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('删除旧缓存:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('所有旧缓存已清除');
      return self.clients.claim();
    })
  );
});

// 请求拦截 - JS文件始终走网络，其他资源网络优先+缓存回退
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // JS文件始终从网络获取，不缓存
  if (url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // 其他资源：网络优先
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) return response;
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
