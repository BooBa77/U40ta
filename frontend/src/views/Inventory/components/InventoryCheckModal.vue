<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50" @click.self="handleCancel">
      <div class="modal-container bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" style="width: 520px; max-width: 90vw; max-height: 85vh;">
        
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ mode === 'auto' ? 'Подтверждение по QR-коду' : 'Подтверждение наличия' }}
          </h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 text-2xl
                   active:bg-gray-100 active:text-gray-900"
            @click="handleCancel"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div class="overflow-y-auto flex-1 p-5 flex flex-col gap-4" v-if="!loadingBook">

          <!-- Информационный блок -->
          <div class="p-3 bg-gray-50 rounded-lg text-sm flex flex-col gap-1.5">
            <div><span class="text-gray-500">Инв. №:</span> {{ invNumber }}</div>
            <div v-if="partyNumber"><span class="text-gray-500">Партия:</span> {{ partyNumber }}</div>
            <div><span class="text-gray-500">Склад / Завод:</span> {{ sklad }} / {{ zavod }}</div>
            
            <div v-if="locationDisplay">
              <span class="text-gray-500">Местоположение:</span> {{ locationDisplay }}
            </div>
            <div v-else class="text-gray-400 italic">Отсутствует в БД</div>

            <div v-if="isOkAuto" class="text-green-700">
              Подтверждено по QR-коду
              <span v-if="okAutoAbr"> ({{ okAutoAbr }})</span>
              <span v-else-if="idUserOkAutoChecked"> #{{ idUserOkAutoChecked }}</span>
              {{ formatDate(dateOkAutoChecked) }}
            </div>

            <div v-if="isOkManual" class="text-blue-700">
              Подтверждено вручную
              <span v-if="okManualAbr"> ({{ okManualAbr }})</span>
              <span v-else-if="idUserOkManualChecked"> #{{ idUserOkManualChecked }}</span>
              {{ formatDate(dateOkManualChecked) }}
            </div>
          </div>

          <!-- Существующий комментарий -->
          <div v-if="existingRem" class="flex flex-col gap-1">
            <label class="text-sm font-medium text-gray-700">Комментарии</label>
            <div class="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 whitespace-pre-wrap max-h-[120px] overflow-y-auto">{{ existingRem }}</div>
          </div>

          <!-- Количество -->
          <div v-if="maxCount > 1" class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700">Количество</label>
            <div class="flex items-center gap-2">
              <input 
                type="number" 
                v-model.number="quantity" 
                :min="1" :max="maxCount" 
                class="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
              <button @click="quantity = maxCount" class="px-3 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium active:bg-gray-300">
                Все
              </button>
            </div>
            <p class="text-xs text-gray-500">Всего записей: {{ maxCount }}</p>
          </div>

          <!-- Новый комментарий -->
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-gray-700">Новый комментарий</label>
            <textarea
              v-model="newComment"
              placeholder="Комментарий"
              class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-y min-h-[70px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              rows="3"
              :disabled="isSaving"
            />
          </div>

          <div v-if="errorMessage" class="text-sm text-red-600 p-3 bg-red-50 rounded-lg border-l-4 border-red-600">
            {{ errorMessage }}
          </div>

        </div>

        <div v-else class="overflow-y-auto flex-1 p-5 flex items-center justify-center text-gray-500">Загрузка...</div>

        <!-- Футер -->
        <div class="flex gap-2 p-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <button 
            @click="handleCancel"
            class="flex-1 py-3 px-4 bg-white text-gray-700 border border-gray-300 rounded-md text-base font-medium active:bg-gray-50"
            :disabled="isSaving"
          >
            Отмена
          </button>
          
          <button 
            v-if="isOkManual && isOwner"
            @click="handleCancelManual"
            class="flex-1 py-3 px-4 bg-red-500 text-white border border-red-600 rounded-md text-base font-medium active:bg-red-600 disabled:opacity-50"
            :disabled="isSaving"
          >
            Отменить ручное подтверждение
          </button>
          
          <button 
            v-else
            @click="handleSave"
            class="flex-1 py-3 px-4 bg-blue-500 text-white border border-blue-500 rounded-md text-base font-medium active:bg-blue-600 disabled:opacity-50"
            :disabled="isSaving || quantity < 1"
          >
            {{ isSaving ? 'Сохранение...' : 'Подтвердить' }}
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { inventoryBookService } from '@/services/inventory-book.service'
import { useCurrentUser } from '@/composables/useCurrentUser'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  mode: { type: String, default: 'manual' },
  itemIds: { type: Array, default: () => [] },
  maxCount: { type: Number, default: 1 },
  bookId: { type: [Number, String], default: null },
  invNumber: { type: String, default: '' },
  partyNumber: { type: String, default: null },
  zavod: { type: [Number, String], default: '' },
  sklad: { type: String, default: '' },
  objectData: { type: Object, default: null },
  isOkManual: { type: Boolean, default: false },
  isOkAuto: { type: Boolean, default: false },
  dateOkManualChecked: { type: String, default: null },
  dateOkAutoChecked: { type: String, default: null },
  idUserOkManualChecked: { type: Number, default: null },
  idUserOkAutoChecked: { type: Number, default: null },
  existingRem: { type: String, default: null }
})

const emit = defineEmits(['save', 'cancel'])

const { userAbr, fetchUserAbr } = useCurrentUser()

const quantity = ref(props.maxCount)
const newComment = ref('')
const isSaving = ref(false)
const errorMessage = ref('')
const isOwner = ref(false)
const loadingBook = ref(false)
const okManualAbr = ref(null)
const okAutoAbr = ref(null)

const locationDisplay = computed(() => {
  if (!props.objectData) return null
  const parts = [
    props.objectData.placeTer,
    props.objectData.placePos,
    props.objectData.placeCab,
    props.objectData.placeUser
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : null
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('ru-RU', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

const buildComment = (oldRem, abr, date, text) => {
  const parts = []
  if (oldRem) parts.push(oldRem)
  const author = abr || 'Офлайн'
  const datePart = date.toLocaleString('ru-RU', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  parts.push(`${author} ${datePart} ${text}`)
  return parts.join('\n')
}

const fetchUserAbrById = async (userId) => {
  if (!userId) return null
  try {
    const token = localStorage.getItem('auth_token')
    const response = await fetch(`/api/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) return null
    const user = await response.json()
    return user.abr || null
  } catch {
    return null
  }
}

const resetForm = () => {
  quantity.value = props.maxCount
  newComment.value = ''
  errorMessage.value = ''
  isSaving.value = false
  okManualAbr.value = null
  okAutoAbr.value = null
}

const loadBookInfo = async () => {
  loadingBook.value = true
  try {
    await fetchUserAbr()

    const [book, manualAbr, autoAbr] = await Promise.all([
      inventoryBookService.getBook(props.bookId),
      fetchUserAbrById(props.idUserOkManualChecked),
      fetchUserAbrById(props.idUserOkAutoChecked)
    ])

    isOwner.value = book.isOwner === true
    okManualAbr.value = manualAbr
    okAutoAbr.value = autoAbr
  } catch (err) {
    console.error('[InventoryCheckModal] Ошибка загрузки:', err)
  } finally {
    loadingBook.value = false
  }
}

const handleSave = async () => {
  if (quantity.value < 1 || quantity.value > props.maxCount) {
    errorMessage.value = 'Некорректное количество'
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  try {
    const idsToConfirm = props.itemIds.slice(0, quantity.value)
    const date = new Date()
    
    const rem = newComment.value.trim()
      ? buildComment(props.existingRem, userAbr.value, date, newComment.value.trim())
      : props.existingRem

    await inventoryBookService.confirmItems(props.bookId, idsToConfirm, {
      isOkManual: props.mode === 'manual',
      isOkAuto: props.mode === 'auto',
      rem,
      ...(props.objectData || {})
    })

    emit('save', { confirmedCount: idsToConfirm.length })
    resetForm()
  } catch (err) {
    errorMessage.value = err.message || 'Ошибка сохранения'
  } finally {
    isSaving.value = false
  }
}

const handleCancelManual = async () => {
  isSaving.value = true
  errorMessage.value = ''

  try {
    const date = new Date()
    
    const rem = buildComment(
      props.existingRem, 
      userAbr.value, 
      date, 
      'Отмена подтверждения' + (newComment.value.trim() ? ' ' + newComment.value.trim() : '')
    )

    await inventoryBookService.confirmItems(props.bookId, props.itemIds, {
      isOkManual: false,
      rem
    })

    emit('save', { cancelledCount: props.itemIds.length })
    resetForm()
  } catch (err) {
    errorMessage.value = err.message || 'Ошибка отмены'
  } finally {
    isSaving.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
  resetForm()
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    resetForm()
    loadBookInfo()
  }
}, { immediate: true })
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
}
.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-5px);
}
</style>