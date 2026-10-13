import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Логика обновления PWA.
 *
 * Как работает:
 * 1. Браузер находит новую версию SW → она остаётся в состоянии waiting
 *    (в install нашего SW нет skipWaiting() — см. src/sw.js).
 * 2. Ждём, пока пользователь освободится: за это отвечает счётчик
 *    занятости из composables/useAppBusy.js. Watcher живёт в App.vue.
 * 3. Шлём новому SW команду SKIP_WAITING.
 * 4. SW активируется → controllerchange → перезагружаем страницу.
 *
 * Сам SW регистрирует сгенерированный плагином registerSW.js (его
 * подключает Vite в index.html при сборке). Здесь мы его только читаем
 * через getRegistration(): второй register() с другим scope или options
 * создал бы вторую регистрацию и запутал обновления.
 *
 * В dev SW не регистрируется вообще (devOptions.enabled: false), поэтому
 * хук молчит.
 */
export function useSwUpdate() {
  /** Готово ли обновление к применению (новый SW ждёт активации). */
  const updatePending = ref(false)

  /** Регистрация, полученная от registerSW.js. */
  let registration = null

  /**
   * Перезагрузку инициировали мы сами.
   *
   * Без этого флага любой controllerchange (например, от clients.claim()
   * при первой установке SW) перезагружал бы страницу — в том числе
   * посреди работы пользователя.
   */
  let reloading = false

  /** Проверить, не ждёт ли новый SW активации. */
  const checkWaiting = () => {
    if (!registration) return
    if (registration.waiting) {
      updatePending.value = true
    }
  }

  /** Активировать новый SW; перезагрузку сделает controllerchange. */
  const applyUpdate = () => {
    if (!registration || !registration.waiting || reloading) return
    reloading = true
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  const onControllerChange = () => {
    // Перезагружаемся только по своей инициативе: чужой controllerchange
    // (первая установка) не повод ронять страницу.
    if (reloading) {
      window.location.reload()
    }
  }

  onMounted(async () => {
    if (!('serviceWorker' in navigator)) return
    if (import.meta.env.DEV) return

    registration = (await navigator.serviceWorker.getRegistration()) || null
    if (!registration) return

    // Новый SW мог уже ждать активации к моменту монтирования
    checkWaiting()

    // Слушаем появление нового SW
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        // controller != null — это обновление уже работающего приложения,
        // а не первая установка (её применять не нужно, страница и так свежая)
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          updatePending.value = true
        }
      })
    })

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
  })

  onUnmounted(() => {
    navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
  })

  return { updatePending, checkWaiting, applyUpdate }
}
