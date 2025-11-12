// Service Worker для U40ta PWA
// Версия: 2025-11-12

const CACHE_VERSION = 'v2'; // ИЗМЕНЯЕМ ПРИ КАЖДОМ ОБНОВЛЕНИИ PWA
const CACHE_NAME = `u40ta-pwa-${CACHE_VERSION}`;

// Критически важные файлы для работы приложения (app shell)
const CRITICAL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',    // если есть основные стили
  '/js/main.js',        // если есть основной скрипт
  '/icons/192.png',
  '/icons/512.png', 
  '/favicon.ico'
];

// ========== УСТАНОВКА ==========
self.addEventListener('install', function(event) {
  console.log(`[SW ${CACHE_VERSION}] Установка новой версии`);
  
  // Принудительно активируем новую версию SW сразу после установки
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Кэшируем критически важные файлы');
        // Кэшируем только самое необходимое для первой загрузки
        return cache.addAll(CRITICAL_URLS);
      })
      .then(function() {
        // НЕ ЖДЁМ закрытия вкладок - сразу активируем новую версию
        console.log('[SW] Пропускаем ожидание и активируемся немедленно');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('[SW] Ошибка при установке:', error);
      })
  );
});

// ========== АКТИВАЦИЯ ==========
self.addEventListener('activate', function(event) {
  console.log(`[SW ${CACHE_VERSION}] Активация`);
  
  event.waitUntil(
    // Очищаем ВСЕ старые кэши от предыдущих версий
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Удаляем все кэши, кроме текущего
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаляем устаревший кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      // Немедленно берём под контроль все открытые вкладки
      console.log('[SW] Забираем контроль над всеми клиентами');
      return self.clients.claim();
    })
  );
});

// ========== ОБРАБОТКА ЗАПРОСОВ ==========
self.addEventListener('fetch', function(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  // ПРОПУСКАЕМ запросы, которые НЕ должны кэшироваться:
  // 1. Запросы к Telegram API
  // 2. Запросы к нашему API (/api/)
  // 3. Внешние ресурсы (другие домены)
  if (request.url.includes('telegram.org') || 
      request.url.includes('/api/') ||
      !request.url.startsWith(self.location.origin)) {
    // Просто пропускаем эти запросы без кэширования
    return fetch(request);
  }

  // ОСНОВНАЯ ЛОГИКА КЭШИРОВАНИЯ
  event.respondWith(
    caches.match(request)
      .then(function(cachedResponse) {
        
        // СТРАТЕГИЯ: Network First для HTML, Cache First для статики
        
        // 1. Для HTML-страниц - сначала сеть, потом кэш
        if (request.destination === 'document' || 
            request.url.endsWith('.html') ||
            url.pathname === '/') {
          return networkFirstStrategy(request);
        }
        
        // 2. Для статики (CSS, JS, иконки) - сначала кэш, потом сеть  
        else if (request.destination === 'style' || 
                request.destination === 'script' ||
                request.destination === 'image' ||
                request.url.includes('/css/') ||
                request.url.includes('/js/') ||
                request.url.includes('/icons/')) {
          return cacheFirstStrategy(request, cachedResponse);
        }
        
        // 3. Для всего остального - сначала сеть
        else {
          return networkFirstStrategy(request);
        }
      })
  );
});

// ========== СТРАТЕГИИ КЭШИРОВАНИЯ ==========

// Сначала пробуем СЕТЬ, потом КЭШ (для HTML, API)
function networkFirstStrategy(request) {
  return fetch(request)
    .then(function(networkResponse) {
      // Если получили ответ из сети - кэшируем его
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then(function(cache) {
            cache.put(request, responseClone);
          });
      }
      return networkResponse;
    })
    .catch(function(error) {
      // Если сети нет - пробуем взять из кэша
      console.log('[SW] Нет сети, пробуем кэш для:', request.url);
      return caches.match(request)
        .then(function(cachedResponse) {
          return cachedResponse || Promise.reject('Нет в кэше и нет сети');
        });
    });
}

// Сначала пробуем КЭШ, потом СЕТЬ (для статики)
function cacheFirstStrategy(request, cachedResponse) {
  // Если есть в кэше - отдаём из кэша
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Если нет в кэше - грузим из сети и кэшируем
  return fetch(request)
    .then(function(networkResponse) {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then(function(cache) {
            cache.put(request, responseClone);
          });
      }
      return networkResponse;
    })
    .catch(function(error) {
      console.error('[SW] Ошибка загрузки:', request.url, error);
      // Можно вернуть заглушку для критичных ресурсов
      return new Response('Resource not available offline');
    });
}

// ========== СИНХРОНИЗАЦИЯ (для будущего) ==========
// Когда добавим IndexedDB, здесь будет логика фоновой синхронизации
self.addEventListener('sync', function(event) {
  console.log('[SW] Фоновая синхронизация:', event.tag);
  // В будущем: синхронизация IndexedDB с PostgreSQL
});

// ========== УВЕДОМЛЕНИЯ (для будущего) ==========
self.addEventListener('push', function(event) {
  console.log('[SW] Push-уведомление получено');
  // В будущем: обработка пуш-уведомлений
});