/**
 * Service Worker u40ta.
 *
 * Собирается Vite (vite-plugin-pwa, стратегия injectManifest): плагин
 * подставляет на место self.__WB_MANIFEST список файлов сборки, которые
 * нужно положить в precache. Свой SW, а не сгенерированный workbox'ом,
 * ради полного контроля над моментом обновления.
 *
 * Логика обновления:
 * - НЕ вызываем skipWaiting() в install: иначе новая версия активируется
 *   сразу, страница перезагружается под руками пользователя — и введённые,
 *   но не сохранённые данные теряются.
 * - Ждём команду { type: 'SKIP_WAITING' } с фронта. Её шлёт
 *   composables/useSwUpdate.js, когда обновление найдено И пользователь
 *   ничем не занят (счётчик занятости — composables/useAppBusy.js).
 */

// Кэши с префиксом проекта: в activate удаляется всё, что не отсюда,
// поэтому чужие и устаревшие кэши (в том числе старый u40ta-pwa-v2
// от прежнего ручного sw.js) вычищаются автоматически.
const PRECACHE = 'u40ta-precache-v1'
const RUNTIME = 'u40ta-runtime-v1'

// Список ассетов сборки, подставленный workbox'ом при сборке
const precacheManifest = self.__WB_MANIFEST

// Установка: кладём ассеты в precache, но НЕ активируемся немедленно.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => {
      return cache.addAll(
        precacheManifest
          .filter((entry) => entry.url)
          .map((entry) => entry.url)
      )
    })
  )
  // никакого self.skipWaiting() здесь — ждём команду с фронта
})

// Активация: чистим посторонние кэши, берём контроль над вкладками.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k !== PRECACHE && k !== RUNTIME)
          .map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

// Сообщение с фронта { type: 'SKIP_WAITING' } — активируемся немедленно.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Fetch: «сначала кэш, потом сеть» для статики.
//
// API не кэшируем: у проекта свои офлайн-режим и синхронизация на Dexie
// (services/offline-cache.service.js, offline-sync.service.js), и второй
// слой кэширования поверх них только запутал бы картину.
self.addEventListener('fetch', (event) => {
  const request = event.request

  // Только GET: POST/PUT/PATCH/DELETE кэшировать нельзя в принципе
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Запросы к API и на чужие домены проходят мимо кэша
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
    })
  )
})
