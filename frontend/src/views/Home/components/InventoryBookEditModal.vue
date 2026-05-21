<template>
  <BaseModal
    :is-open="isOpen"
    :title="bookId > 0 ? 'Редактирование описи' : 'Новая инвентаризация'"
    width="600px"
    @close="$emit('close')"
  >
    <!-- Поле названия книги -->
    <div class="field">
      <label class="field-label">Придумайте название описи</label>
      <input
        v-model="bookName"
        type="text"
        class="field-input"
        placeholder="Введите название"
        :disabled="isSaving"
      />
    </div>

    <!-- Список batch'ей -->
    <div class="batches-section">
      <label class="field-label">
        {{ bookId > 0 ? 'Состав описи' : 'Выберите ведомости' }}
      </label>

      <div v-if="isLoadingBatches" class="batches-empty">Загрузка...</div>
      <div v-else-if="batches.length === 0" class="batches-empty">Нет доступных ведомостей</div>

      <div v-else class="batches-list">
        <div v-for="batch in batches" :key="batchKey(batch)" class="batch-row">
          <label class="batch-label">
            <input
              v-model="selectedBatchKeys"
              type="checkbox"
              :value="batchKey(batch)"
              :disabled="isSaving"
              @change="onBatchToggle(batch)"
            />
            <span class="batch-info">
              <span class="batch-date">{{ formatDate(batch.receivedAt) }}</span>
              <span class="batch-name">{{ batch.docType }} — {{ batch.sklad }}</span>
              <span class="batch-count">{{ batch.count }} строк</span>
              <span v-if="bookId > 0 && hasConfirmedItems(batch)" class="batch-warning" title="Осторожно">⚠</span>
            </span>
          </label>
          <button
            v-if="bookId === 0"
            class="batch-delete"
            title="Удалить ведомость"
            :disabled="isSaving"
            @click="deleteBatch(batch)"
          >🗑</button>
        </div>
      </div>
    </div>

    <!-- Секция доступа -->
    <div class="access-section">
      <label class="field-label">Предоставить коллегам доступ к описи</label>

      <div v-if="isLoadingAccess" class="batches-empty">Загрузка...</div>
      <div v-else-if="revisors.length === 0" class="batches-empty">пока других ревизоров нет</div>

      <div v-else class="batches-list">
        <div v-for="revisor in revisors" :key="revisor.id" class="batch-row">
          <label class="batch-label">
            <input
              v-model="selectedRevisorIds"
              type="checkbox"
              :value="revisor.id"
              :disabled="isSaving || revisor.id === currentUserId"
            />
            <span class="batch-info">
              <span class="batch-name">{{ revisor.abr }} — {{ revisor.firstName }} {{ revisor.lastName }}</span>
            </span>
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        v-if="bookId > 0"
        class="bg-red-500 text-white font-medium px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        :disabled="isSaving"
        @click="handleDeleteBook"
      >
        Удалить книгу
      </button>

      <div v-if="bookId > 0" class="flex-1"></div>

      <button
        v-if="bookId === 0"
        class="border border-gray-300 text-gray-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
        @click="$emit('close')"
      >
        Отмена
      </button>

      <button
        class="bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition"
        :disabled="isSaving || !bookName.trim() || (bookId === 0 && selectedBatchKeys.length === 0)"
        @click="handleSave"
      >
        {{ isSaving ? 'Сохранение...' : bookId > 0 ? 'Применить' : 'Создать' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { inventoryStatementsService } from '@/services/inventory-statements.service'
import { inventoryBookService } from '@/services/inventory-book.service'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  bookId: { type: Number, default: 0 }
})

const emit = defineEmits(['close', 'saved', 'deleted'])

// Состояния
const bookName = ref('')
const isSaving = ref(false)
const isLoadingBatches = ref(false)
const batches = ref([])
const selectedBatchKeys = ref([])
const bookItems = ref([])
const statementBatchMap = ref({})

// Доступ
const isLoadingAccess = ref(false)
const revisors = ref([])
const selectedRevisorIds = ref([])
const currentUserId = ref(null)

// Утилиты
const batchKey = (batch) => `${batch.emailFrom}|${batch.receivedAt}|${batch.zavod}|${batch.sklad}`

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('ru-RU')
}

const hasConfirmedItems = (batch) => {
  if (props.bookId === 0) return false
  return bookItems.value.some(
    item =>
      item.idInventoryStatement &&
      statementBatchMap.value[item.idInventoryStatement] === batchKey(batch) &&
      (item.isOkManual || item.isOkAuto)
  )
}

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

const loadBatches = async () => {
  isLoadingBatches.value = true
  try {
    batches.value = await inventoryStatementsService.getBatches()
  } catch (error) {
    console.error('Ошибка загрузки batch\'ей:', error)
    batches.value = []
  } finally {
    isLoadingBatches.value = false
  }
}

const loadBookData = async () => {
  if (props.bookId === 0) return

  isLoadingBatches.value = true

  try {
    const [book, items] = await Promise.all([
      inventoryBookService.getBook(props.bookId),
      inventoryBookService.getBookItems(props.bookId)
    ])

    bookName.value = book.name || ''
    bookItems.value = items

    const statementIds = [...new Set(items.map(i => i.idInventoryStatement).filter(Boolean))]
    const allBatches = await inventoryStatementsService.getBatches()
    batches.value = allBatches

    const map = {}
    for (const batch of allBatches) {
      try {
        const batchItems = await inventoryStatementsService.getBatchItems(
          batch.emailFrom, batch.receivedAt, batch.zavod, batch.sklad
        )
        for (const item of batchItems) {
          map[item.id] = batchKey(batch)
        }
      } catch (e) { /* batch мог быть удалён */ }
    }
    statementBatchMap.value = map

    selectedBatchKeys.value = []
    for (const statementId of statementIds) {
      const key = map[statementId]
      if (key && !selectedBatchKeys.value.includes(key)) {
        selectedBatchKeys.value.push(key)
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки книги:', error)
  } finally {
    isLoadingBatches.value = false
  }
}

const loadRevisors = async () => {
  isLoadingAccess.value = true
  try {
    const token = localStorage.getItem('auth_token')
    
    const payloadBase64 = token.split('.')[1]
    const payloadJson = atob(payloadBase64)
    const payload = JSON.parse(payloadJson)
    currentUserId.value = payload.sub
    
    const response = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (response.ok) {
      const data = await response.json()
      revisors.value = data // все пользователи, включая себя
    }
  } catch (error) {
    console.error('Ошибка загрузки ревизоров:', error)
    revisors.value = []
  } finally {
    isLoadingAccess.value = false
  }
}

const loadAccess = async () => {
  if (props.bookId === 0) return

  try {
    const access = await inventoryBookService.getBookAccess(props.bookId)
    // Отмечаем чекбоксы для ревизоров с доступом
    selectedRevisorIds.value = access.map(a => a.userId)
  } catch (error) {
    console.error('Ошибка загрузки доступа:', error)
  }
}

// ============================================================================
// ДЕЙСТВИЯ
// ============================================================================

const onBatchToggle = (batch) => {
  if (props.bookId === 0) return

  const key = batchKey(batch)
  const isChecked = selectedBatchKeys.value.includes(key)

  if (!isChecked && hasConfirmedItems(batch)) {
    selectedBatchKeys.value.push(key) // возвращаем обратно
    if (confirm(
      'В этом пакете есть подтверждённые объекты. При исключении все наработки будут потеряны. Продолжить?'
    )) {
      selectedBatchKeys.value = selectedBatchKeys.value.filter(k => k !== key)
    }
  }
}

const deleteBatch = async (batch) => {
  if (!confirm('Удалить эту ведомость безвозвратно?')) return

  try {
    await inventoryStatementsService.deleteBatch(batch.emailFrom, batch.receivedAt, batch.zavod, batch.sklad)
    batches.value = batches.value.filter(b => batchKey(b) !== batchKey(batch))
    selectedBatchKeys.value = selectedBatchKeys.value.filter(k => k !== batchKey(batch))
  } catch (error) {
    console.error('Ошибка удаления batch\'а:', error)
    alert('Не удалось удалить ведомость')
  }
}

const getStatementIdsFromBatches = async () => {
  const ids = []
  for (const key of selectedBatchKeys.value) {
    const [emailFrom, receivedAt, zavod, sklad] = key.split('|')
    try {
      const items = await inventoryStatementsService.getBatchItems(emailFrom, receivedAt, Number(zavod), sklad)
      ids.push(...items.map(i => i.id))
    } catch (e) {
      console.error('Ошибка получения строк batch\'а:', e)
    }
  }
  return ids
}

const handleSave = async () => {
  if (!bookName.value.trim()) return
  if (props.bookId === 0 && selectedBatchKeys.value.length === 0) return

  isSaving.value = true

  try {
    let currentBookId = props.bookId

    // Создание новой книги
    if (currentBookId === 0) {
      const allItems = []
      for (const key of selectedBatchKeys.value) {
        const [emailFrom, receivedAt, zavod, sklad] = key.split('|')
        const items = await inventoryStatementsService.getBatchItems(emailFrom, receivedAt, Number(zavod), sklad)
        allItems.push(...items.map(item => ({
          idInventoryStatement: item.id,
          zavod: item.zavod,
          sklad: item.sklad,
          invNumber: item.invNumber,
          partyNumber: item.partyNumber,
          buhName: item.buhName,
        })))
      }
      const book = await inventoryBookService.createBook(bookName.value.trim(), allItems)
      currentBookId = book.id
    } else {
      // Редактирование существующей
      const statementIds = await getStatementIdsFromBatches()
      await inventoryBookService.updateBook(currentBookId, {
        name: bookName.value.trim(),
        itemIds: statementIds
      })
    }

    // Сохраняем доступ
    const currentAccess = await inventoryBookService.getBookAccess(currentBookId)
    const currentUserIds = currentAccess.map(a => a.userId)

    // Добавить новых
    for (const userId of selectedRevisorIds.value) {
      if (!currentUserIds.includes(userId)) {
        await inventoryBookService.addBookAccess(currentBookId, userId)
      }
    }

    // Удалить снятых
    for (const userId of currentUserIds) {
      if (!selectedRevisorIds.value.includes(userId)) {
        await inventoryBookService.removeBookAccess(currentBookId, userId)
      }
    }

    emit('saved', currentBookId)
    emit('close')
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    alert('Не удалось сохранить')
  } finally {
    isSaving.value = false
  }
}

const handleDeleteBook = async () => {
  if (!confirm('Удалить книгу безвозвратно? Это действие нельзя отменить.')) return
  if (props.bookId === 0) return

  isSaving.value = true
  try {
    await inventoryBookService.deleteBook(props.bookId)
    emit('deleted')
    emit('close')
  } catch (error) {
    console.error('Ошибка удаления книги:', error)
    alert('Не удалось удалить книгу')
  } finally {
    isSaving.value = false
  }
}

const reset = () => {
  bookName.value = ''
  selectedBatchKeys.value = []
  batches.value = []
  bookItems.value = []
  statementBatchMap.value = {}
  revisors.value = []
  selectedRevisorIds.value = []
  currentUserId.value = null
}

// ============================================================================
// WATCH
// ============================================================================

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    // Получаем currentUserId сразу из токена
    const token = localStorage.getItem('auth_token')
    if (token) {
      const payloadBase64 = token.split('.')[1]
      const payloadJson = atob(payloadBase64)
      const payload = JSON.parse(payloadJson)
      currentUserId.value = payload.sub
    }
    
    loadRevisors()
    if (props.bookId > 0) {
      loadBookData()
      loadAccess()
    } else {
      loadBatches()
      // При создании — создатель уже выбран
      if (currentUserId.value) {
        selectedRevisorIds.value = [currentUserId.value]
      }
    }
  } else {
    reset()
  }
})
</script>

<style scoped>
.field { margin-bottom: 16px; }
.field-label { display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px; }
.field-input {
  width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px;
  font-size: 14px; font-family: inherit; transition: border-color 0.2s; box-sizing: border-box;
}
.field-input:focus { outline: none; border-color: #3b82f6; }

.batches-section, .access-section { margin-top: 16px; }
.batches-list { max-height: 250px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
.batches-empty { text-align: center; padding: 20px; color: #9ca3af; font-style: italic; }

.batch-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
.batch-row:last-child { border-bottom: none; }
.batch-label { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; }
.batch-info { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.batch-date { font-size: 12px; color: #6b7280; }
.batch-name { font-weight: 500; font-size: 13px; }
.batch-count { font-size: 12px; color: #9ca3af; }
.batch-warning { font-size: 14px; color: #f59e0b; cursor: help; }

.batch-delete {
  background: none; border: none; font-size: 16px; cursor: pointer;
  padding: 4px 8px; border-radius: 6px; transition: background-color 0.2s;
}
.batch-delete:hover:not(:disabled) { background-color: #fee2e2; }
.batch-delete:disabled { opacity: 0.4; cursor: not-allowed; }

.flex-1 { flex: 1; }

.batches-list::-webkit-scrollbar { width: 4px; }
.batches-list::-webkit-scrollbar-track { background: #f1f3f5; border-radius: 4px; }
.batches-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
</style>