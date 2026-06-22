<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Хедер -->
    <header class="flex justify-between items-center p-4 bg-white border-b border-gray-200 flex-shrink-0">
      <div class="text-gray-700 font-medium">
        Объект
      </div>
      <button
        class="text-gray-400 hover:text-gray-600 text-sm"
        @click="handleClose"
      >
        Закрыть
      </button>
    </header>

    <main class="flex-1 flex flex-col overflow-y-auto">
      <!-- Загрузка -->
      <div v-if="isLoading" class="flex-1 flex items-center justify-center text-gray-500">
        Поиск объекта...
      </div>

      <!-- Объект не найден -->
      <div v-else-if="notFound" class="flex-1 flex items-center justify-center p-5">
        <div class="text-center">
          <p class="text-gray-500 text-lg mb-2">Объект не обнаружен в системе</p>
          <p class="text-gray-400 text-sm">QR-код не найден в базе данных</p>
          <button
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm
                   hover:bg-blue-600 active:bg-blue-700 transition-colors"
            @click="handleClose"
          >
            Закрыть
          </button>
        </div>
      </div>

      <!-- Ошибка -->
      <div v-else-if="errorMessage" class="flex-1 flex items-center justify-center p-5">
        <div class="text-center">
          <p class="text-red-500 text-lg mb-2">Ошибка</p>
          <p class="text-gray-500 text-sm">{{ errorMessage }}</p>
          <button
            class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm
                   hover:bg-blue-600 active:bg-blue-700 transition-colors"
            @click="handleClose"
          >
            Закрыть
          </button>
        </div>
      </div>

      <!-- Карточка объекта -->
      <template v-else-if="objectId">
        <ObjectFormModal
          :is-open="showObjectForm"
          :object-id="objectId"
          :initial-data="restoredChanges || {}"
          :guest-mode="!hasToken"
          @save="handleObjectSaved"
          @cancel="handleClose"
          @guest-save="handleGuestSave"
          @guest-need-auth="handleGuestNeedAuth"
        />
      </template>

      <!-- Уведомление после возврата с авторизации -->
      <div
        v-if="showRestoreNotification"
        class="mx-4 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800"
      >
        Вы вернулись после авторизации. Нажмите «Сохранить» для применения изменений.
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ObjectFormModal from '@/components/ObjectForm/ObjectFormModal.vue'
import { qrService } from '@/services/qr-service.js'

const DEEP_LINK_STORAGE_KEY = 'deepLinkRestore'

const router = useRouter()
const route = useRoute()

const isLoading = ref(true)
const notFound = ref(false)
const errorMessage = ref('')
const objectId = ref(null)
const showObjectForm = ref(false)
const showRestoreNotification = ref(false)

/**
 * Есть ли токен авторизации
 */
const hasToken = computed(() => {
  return !!localStorage.getItem('auth_token')
})

/**
 * Восстановленные изменения из sessionStorage
 */
const restoredChanges = ref(null)

/**
 * Извлечь код из URL
 * Может быть полной ссылкой или просто кодом из :qrCode
 */
const extractQrCode = () => {
  const fullPath = route.fullPath
  // Если передан параметр маршрута
  const qrCode = route.params.qrCode
  if (qrCode) {
    // Собираем полный URL для поиска в базе
    return window.location.origin + '/scan/' + qrCode
  }
  return null
}

/**
 * Показать уведомление гостю перед редиректом на логин
 */
const showGuestNotification = (message) => {
  // Сохраняем сообщение в sessionStorage, чтобы Login показал его
  const storage = getStorage()
  storage.notification = message
  saveStorage(storage)
}

/**
 * Получить данные из sessionStorage
 */
const getStorage = () => {
  try {
    const raw = sessionStorage.getItem(DEEP_LINK_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Сохранить данные в sessionStorage
 */
const saveStorage = (data) => {
  sessionStorage.setItem(DEEP_LINK_STORAGE_KEY, JSON.stringify(data))
}

/**
 * Очистить sessionStorage
 */
const clearStorage = () => {
  sessionStorage.removeItem(DEEP_LINK_STORAGE_KEY)
}

/**
 * Редирект на логин
 */
const redirectToLogin = (notification) => {
  const storage = getStorage()
  storage.redirectPath = route.fullPath
  if (notification) {
    storage.notification = notification
  }
  saveStorage(storage)

  if (import.meta.env.DEV) {
    router.push('/dev-login')
  } else {
    router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
  }
}

/**
 * Обработчик guest-save от ObjectFormModal
 * Гость нажал «Сохранить» с изменениями
 */
const handleGuestSave = (changes) => {
  const storage = getStorage()
  storage.objectId = objectId.value
  storage.changes = changes
  saveStorage(storage)

  redirectToLogin('Для сохранения изменений требуется авторизация')
}

/**
 * Обработчик guest-need-auth от ObjectFormModal
 * Гость нажал «Добавить фото» или «Добавить QR-код»
 */
const handleGuestNeedAuth = (reason, currentChanges) => {
  const storage = getStorage()
  storage.objectId = objectId.value
  if (currentChanges) {
    storage.changes = currentChanges
  }
  saveStorage(storage)

  const messages = {
    photo: 'Для добавления фото требуется авторизация',
    qr: 'Для добавления QR-кода требуется авторизация'
  }
  redirectToLogin(messages[reason] || 'Требуется авторизация')
}

/**
 * Объект сохранён (после возврата с авторизации)
 */
const handleObjectSaved = () => {
  showObjectForm.value = false
  clearStorage()
  router.push('/')
}

/**
 * Закрыть карточку
 */
const handleClose = () => {
  showObjectForm.value = false
  clearStorage()
  router.push('/')
}

/**
 * Инициализация
 */
onMounted(async () => {
  const qrCode = extractQrCode()

  if (!qrCode) {
    isLoading.value = false
    notFound.value = true
    return
  }

  try {
    const result = await qrService.findObjectByQrCode(qrCode)

    if (result && result.objectId) {
      objectId.value = result.objectId

      // Проверяем sessionStorage — есть ли восстановленные данные
      const storage = getStorage()

      // Показываем уведомление от Login, если есть
      if (storage.notification && hasToken.value) {
        // Уведомление уже показано в Login, очищаем
        delete storage.notification
        saveStorage(storage)
      }

      // Если есть сохранённые изменения и токен — восстанавливаем
      if (storage.changes && storage.objectId === result.objectId && hasToken.value) {
        restoredChanges.value = storage.changes
        showRestoreNotification.value = true
        // Не чистим storage здесь — почистим после сохранения
      } else if (!hasToken.value) {
        // Гость без сохранённых изменений — просто смотрим
        restoredChanges.value = null
      }

      showObjectForm.value = true
    } else {
      notFound.value = true
    }
  } catch (error) {
    console.error('[DeepLink] Ошибка поиска объекта:', error)
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage.value = 'Проверьте подключение к интернету'
    } else {
      errorMessage.value = error.message || 'Ошибка при поиске объекта'
    }
  } finally {
    isLoading.value = false
  }
})
</script>