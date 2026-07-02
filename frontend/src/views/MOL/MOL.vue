<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Хедер -->
    <header class="flex items-center gap-3 p-4 bg-white border-b border-gray-200 flex-shrink-0">
      <button
        class="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md
               active:bg-gray-100 transition"
        @click="handleBack"
      >
        ← Назад
      </button>
      <h1 class="text-lg font-semibold text-gray-800">инструменты МОЛ</h1>
    </header>

    <!-- Контент -->
    <main class="flex-1 overflow-y-auto p-4">
      
      <!-- Состояние загрузки -->
      <div v-if="isLoading" class="py-10 text-center text-gray-500">
        Загрузка данных...
      </div>

      <!-- Состояние ошибки -->
      <div v-else-if="error" class="py-10 text-center text-red-600">
        <p>{{ error }}</p>
        <button 
          @click="loadProposedChanges" 
          class="mt-4 px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium
                 active:bg-red-600"
        >
          Повторить
        </button>
      </div>

      <!-- Таблица с предлагаемыми изменениями -->
      <div v-else-if="proposedChanges.length > 0" class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th class="bg-gray-50 px-2 py-3 text-center font-semibold text-gray-800 border-b-2 border-gray-200 w-[40px] text-center">
                №
              </th>
              <th class="bg-gray-50 px-2 py-3 text-center font-semibold text-gray-800 border-b-2 border-gray-200">
                Предлагаемое изменение
              </th>
              <th class="bg-gray-50 px-2 py-3 text-center font-semibold text-gray-800 border-b-2 border-gray-200 w-[120px]">
                Решение
              </th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(change, index) in proposedChanges" 
              :key="change.id" 
              class="active:bg-gray-50"
            >
              <td class="px-2 py-3 border-b border-gray-100 text-center text-gray-500 font-medium align-top">
                {{ index + 1 }}
                <div class="text-[11px] text-blue-400 mt-0.5">{{ change.userAbr }}</div>
              </td>
              <td class="px-2 py-3 border-b border-gray-100 text-gray-600">
                <div class="text-xs text-gray-400 mb-1">
                  {{ change.objectBuhName }} ({{ change.objectInvNumber }})
                </div>
                <!-- Описание изменения -->
                <div class="font-medium">{{ formatChangeDescription(change) }}</div>
                <!-- Миниатюра фото -->
                <div v-if="change.changeType === 'photo' && change.photoThumbUrl" class="mt-1">
                  <img 
                    :src="change.photoThumbUrl" 
                    class="w-16 h-16 object-cover rounded border border-gray-200 cursor-pointer active:border-blue-500"
                    @click="openPhotoViewer(change)"
                  />
                </div>
                <div v-else-if="change.changeType === 'photo' && change.isLoadingPhoto" class="mt-1 text-xs text-gray-400 italic">
                  Загрузка фото...
                </div>
              </td>
              <td class="px-2 py-3 border-b border-gray-100 text-center align-top">
                <div class="flex gap-2 justify-center">
                  <button 
                    @click="handleDecision(change.id, 'approved')"
                    :class="[
                      'px-3 py-1.5 rounded-md text-xs font-medium transition',
                      change.decision === 'approved'
                        ? 'bg-green-500 text-white'
                        : change.decision !== null
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-gray-100 text-gray-700 active:bg-green-500 active:text-white'
                    ]"
                  >
                    Да
                  </button>
                  <button 
                    @click="handleDecision(change.id, 'rejected')"
                    :class="[
                      'px-3 py-1.5 rounded-md text-xs font-medium transition',
                      change.decision === 'rejected'
                        ? 'bg-red-500 text-white'
                        : change.decision !== null
                          ? 'bg-gray-100 text-gray-400'
                          : 'bg-gray-100 text-gray-700 active:bg-red-500 active:text-white'
                    ]"
                  >
                    Нет
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Пустое состояние -->
      <div v-else class="py-10 text-center text-gray-400 italic">
        Нет предлагаемых изменений
      </div>

    </main>

    <!-- Кнопка сохранения решений -->
    <footer v-if="proposedChanges.length > 0" class="p-4 bg-white border-t border-gray-200 flex-shrink-0">
      <button
        @click="handleSaveDecisions"
        :disabled="!hasDecisions || isSaving"
        :class="[
          'w-full py-3 rounded-lg text-base font-medium transition',
          hasDecisions && !isSaving
            ? 'bg-gray-900 text-white active:bg-black'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
        ]"
      >
        {{ isSaving ? 'Сохранение...' : 'Сохранить решения' }}
      </button>
    </footer>

    <!-- Простой просмотрщик фото -->
    <Transition name="modal">
      <div 
        v-if="isPhotoViewerOpen" 
        class="fixed inset-0 z-[1000] bg-black flex items-center justify-center"
        @click="closePhotoViewer"
      >
        <!-- Кнопка закрытия -->
        <button 
          class="fixed top-5 right-5 w-11 h-11 rounded-full 
                 bg-black/50 text-white text-2xl
                 flex items-center justify-center
                 backdrop-blur-sm z-[10001]
                 active:bg-black/80"
          @click.stop="closePhotoViewer"
        >
          ×
        </button>
        
        <img 
          v-if="viewerPhotoUrl"
          :src="viewerPhotoUrl"
          class="max-w-full max-h-full object-contain select-none"
          alt="Фото"
        />
        <div v-else class="text-white/70">Загрузка...</div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { photoService } from '@/services/photo.service'

const router = useRouter()

/**
 * Возврат на главную страницу
 */
const handleBack = () => {
  router.push('/')
}

// ============================================================================
// СОСТОЯНИЯ
// ============================================================================

const isLoading = ref(false)
const isSaving = ref(false)
const error = ref(null)
const proposedChanges = ref([])

// Просмотр фото
const isPhotoViewerOpen = ref(false)
const viewerPhotoUrl = ref(null)
let viewerRevokeFn = null

// Для очистки ObjectURL миниатюр при уходе
const thumbUrls = ref([])

// ============================================================================
// ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
// ============================================================================

/** Есть ли хотя бы одно решение */
const hasDecisions = computed(() => {
  return proposedChanges.value.some(change => change.decision !== null)
})

// ============================================================================
// ФОРМАТИРОВАНИЕ
// ============================================================================

/**
 * Форматирует описание изменения для отображения в таблице.
 * @param {Object} change — запись proposed_change
 * @returns {string} человекочитаемое описание
 */
const formatChangeDescription = (change) => {
  const data = change.proposedData || {}

  switch (change.changeType) {
    case 'place': {
      const parts = [
        data.placeTer,
        data.placePos,
        data.placeCab,
        data.placeUser
      ].filter(p => p && p.trim() !== '')
      return parts.length > 0
        ? `Перемещение: ${parts.join(' / ')}`
        : 'Перемещение (местоположение не указано)'
    }

    case 'sn':
      return data.sn
        ? `Смена s/n на «${data.sn}»`
        : 'Очистка s/n'

    case 'comment':
      return `«${data.comment || ''}»`

    case 'photo':
      return 'Добавление фото'

    case 'qr_code':
      return `Добавление QR-кода: ${data.qrValue || '—'}`

    default:
      return `Изменение типа «${change.changeType}»`
  }
}

// ============================================================================
// ЗАГРУЗКА ФОТО
// ============================================================================

/**
 * Загружает миниатюры для всех фото-предложений.
 */
const loadPhotoThumbnails = async () => {
  for (const change of proposedChanges.value) {
    if (change.changeType === 'photo' && change.photoId) {
      change.isLoadingPhoto = true
      try {
        const { url, revoke } = await photoService.createObjectURL(change.photoId, 'thumb')
        change.photoThumbUrl = url
        thumbUrls.value.push({ url, revoke })
      } catch (err) {
        console.error(`[MOL] Ошибка загрузки миниатюры фото ${change.photoId}:`, err)
      } finally {
        change.isLoadingPhoto = false
      }
    }
  }
}

/**
 * Открывает просмотрщик фото для предложения.
 * @param {Object} change — запись proposed_change с changeType === 'photo'
 */
const openPhotoViewer = async (change) => {
  if (change.changeType !== 'photo' || !change.photoId) return

  try {
    const { url, revoke } = await photoService.createObjectURL(change.photoId, 'full')
    viewerPhotoUrl.value = url
    viewerRevokeFn = revoke
    isPhotoViewerOpen.value = true
  } catch (err) {
    console.error(`[MOL] Ошибка загрузки фото ${change.photoId}:`, err)
  }
}

/**
 * Закрывает просмотрщик фото и освобождает URL.
 */
const closePhotoViewer = () => {
  isPhotoViewerOpen.value = false
  if (viewerRevokeFn) {
    viewerRevokeFn()
    viewerRevokeFn = null
  }
  viewerPhotoUrl.value = null
}

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

/**
 * Загрузка предлагаемых изменений через API.
 */
const loadProposedChanges = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    const token = localStorage.getItem('auth_token')
    if (!token) throw new Error('Токен авторизации не найден')

    const response = await fetch('/api/proposed-changes', {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (!response.ok) {
      throw new Error(`Ошибка HTTP ${response.status}`)
    }

    const data = await response.json()
    
    proposedChanges.value = data.map(change => ({
      ...change,
      decision: null,
      photoThumbUrl: null,
      isLoadingPhoto: false
    }))

    // Загружаем миниатюры фото
    await loadPhotoThumbnails()
  } catch (e) {
    error.value = 'Ошибка загрузки данных'
    console.error('[MOL]', e)
  } finally {
    isLoading.value = false
  }
}

// ============================================================================
// ОБРАБОТЧИКИ
// ============================================================================

/**
 * Обработчик принятия решения (Да/Нет).
 * @param {number} changeId — ID записи
 * @param {string} decision — 'approved' или 'rejected'
 */
const handleDecision = (changeId, decision) => {
  const change = proposedChanges.value.find(c => c.id === changeId)
  if (!change) return
  // Если нажата та же кнопка повторно — отменить решение
  if (change.decision === decision) {
    change.decision = null
  } else {
    change.decision = decision
  }
}

/**
 * Сохранение всех решений.
 * Для каждого approved вызывает POST /approve, для rejected — DELETE.
 */
const handleSaveDecisions = async () => {
  if (!hasDecisions.value || isSaving.value) return
  
  isSaving.value = true
  error.value = null
  
  const token = localStorage.getItem('auth_token')
  if (!token) {
    error.value = 'Токен авторизации не найден'
    isSaving.value = false
    return
  }

  const decisions = proposedChanges.value.filter(c => c.decision !== null)
  let successCount = 0
  let failCount = 0

  try {
    for (const change of decisions) {
      try {
        if (change.decision === 'approved') {
          const response = await fetch(`/api/proposed-changes/${change.id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
        } else {
          const response = await fetch(`/api/proposed-changes/${change.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
        }
        successCount++
      } catch (err) {
        console.error(`[MOL] Ошибка сохранения решения для ${change.id}:`, err)
        failCount++
      }
    }
    
    console.log(`[MOL] Сохранено: ${successCount}, ошибок: ${failCount}`)
    
    await loadProposedChanges()
    
  } catch (e) {
    error.value = 'Ошибка сохранения решений'
    console.error('[MOL]', e)
  } finally {
    isSaving.value = false
  }
}

// ============================================================================
// ОЧИСТКА РЕСУРСОВ
// ============================================================================

/**
 * Освобождает все созданные ObjectURL.
 */
const cleanupUrls = () => {
  for (const { url, revoke } of thumbUrls.value) {
    if (revoke) revoke()
  }
  thumbUrls.value = []
  
  if (viewerRevokeFn) {
    viewerRevokeFn()
    viewerRevokeFn = null
  }
}

// ============================================================================
// ЖИЗНЕННЫЙ ЦИКЛ
// ============================================================================

onMounted(() => {
  loadProposedChanges()
})

onBeforeUnmount(() => {
  cleanupUrls()
})
</script>

<style scoped>
/* Анимация модалки */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>