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
            :disabled="isSaving"
            @click="deleteBatch(batch)"
          ><span v-html="deleteIcon"></span>
          </button>
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

      <button
        v-if="bookId > 0"
        class="bg-green-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 justify-center"
        :disabled="isSaving"
        @click="handleExportExcel"
      >
        <img :src="ExcelIcon" alt="Excel" class="w-5 h-5" />
        Выгрузить
      </button>

      <button
        v-if="bookId > 0"
        class="bg-blue-500 text-white font-medium px-4 py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        :disabled="isSaving"
        @click="handleDeleteBook"
      >
        Задействовать МОЛ
      </button>
            
      <div v-if="bookId > 0" class="flex-1"></div>

      <button
        v-if="bookId > 0"
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
// ВЫГРУЗКА ДАННЫХ
// ============================================================================
const handleExportExcel = async () => {
  isSaving.value = true
  try {
    const result = await inventoryBookService.exportBookToExcel(props.bookId)
    alert(result.message || 'Направлено Вам на почту')
  } catch (error) {
    console.error('Ошибка выгрузки:', error)
    alert('Не удалось выгрузить')
  } finally {
    isSaving.value = false
  }
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

// Иконки
// Иконка DELETE
const deleteIcon = `<svg width="32" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M8.53113 1C5.52364 1 3.19671 3.63591 3.56974 6.62017L5.28873 20.3721C5.47639 21.8734 6.7526 23 8.26557 23H15.7344C17.2474 23 18.5236 21.8734 18.7113 20.3721L20.4303 6.62017C20.8033 3.63591 18.4764 1 15.4689 1H8.53113ZM5.70148 5C6.11066 3.8455 7.21175 3 8.53113 3H15.4689C16.7883 3 17.8893 3.8455 18.2985 5H5.70148ZM5.63279 7L7.27329 20.124C7.33584 20.6245 7.76124 21 8.26557 21H15.7344C16.2388 21 16.6642 20.6245 16.7267 20.124L18.3672 7H5.63279Z" fill="currentColor"/>
  <path d="M15.002 10.998C14.6114 10.6075 13.9783 10.6075 13.5878 10.998L12 12.5858L10.4201 11.0058C10.0296 10.6153 9.3964 10.6153 9.00587 11.0058C8.61535 11.3964 8.61535 12.0295 9.00587 12.4201L10.5858 14L9.00001 15.5858C8.60949 15.9763 8.60949 16.6095 9.00001 17C9.39054 17.3905 10.0237 17.3905 10.4142 17L12 15.4142L13.5878 17.0019C13.9783 17.3925 14.6114 17.3925 15.002 17.0019C15.3925 16.6114 15.3925 15.9782 15.002 15.5877L13.4142 14L15.002 12.4123C15.3925 12.0217 15.3925 11.3886 15.002 10.998Z" fill="currentColor"/>
</svg>`;
// иконка excel
const ExcelIcon = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IS0tINCh0LrQsNGH0LDQvdC+INGBINGB0LDQudGC0LAgc3ZnNC5ydSAvIERvd25sb2FkZWQgZnJvbSBzdmc0LnJ1IC0tPgo8c3ZnIHdpZHRoPSI4MDBweCIgaGVpZ2h0PSI4MDBweCIgdmlld0JveD0iMCAwIDMyIDMyIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImEiIHgxPSI0LjQ5NCIgeTE9Ii0yMDkyLjA4NiIgeDI9IjEzLjgzMiIgeTI9Ii0yMDc1LjkxNCIgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgwIDIxMDApIiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjMTg4ODRmIi8+PHN0b3Agb2Zmc2V0PSIwLjUiIHN0b3AtY29sb3I9IiMxMTdlNDMiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwYjY2MzEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48dGl0bGU+ZmlsZV90eXBlX2V4Y2VsPC90aXRsZT48cGF0aCBkPSJNMTkuNTgxLDE1LjM1LDguNTEyLDEzLjRWMjcuODA5QTEuMTkyLDEuMTkyLDAsMCwwLDkuNzA1LDI5aDE5LjFBMS4xOTIsMS4xOTIsMCwwLDAsMzAsMjcuODA5aDBWMjIuNVoiIHN0eWxlPSJmaWxsOiMxODVjMzciLz48cGF0aCBkPSJNMTkuNTgxLDNIOS43MDVBMS4xOTIsMS4xOTIsMCwwLDAsOC41MTIsNC4xOTFoMFY5LjVMMTkuNTgxLDE2bDUuODYxLDEuOTVMMzAsMTZWOS41WiIgc3R5bGU9ImZpbGw6IzIxYTM2NiIvPjxwYXRoIGQ9Ik04LjUxMiw5LjVIMTkuNTgxVjE2SDguNTEyWiIgc3R5bGU9ImZpbGw6IzEwN2M0MSIvPjxwYXRoIGQ9Ik0xNi40MzQsOC4ySDguNTEyVjI0LjQ1aDcuOTIyYTEuMiwxLjIsMCwwLDAsMS4xOTQtMS4xOTFWOS4zOTFBMS4yLDEuMiwwLDAsMCwxNi40MzQsOC4yWiIgc3R5bGU9Im9wYWNpdHk6MC4xMDAwMDAwMDE0OTAxMTYxMjtpc29sYXRpb246aXNvbGF0ZSIvPjxwYXRoIGQ9Ik0xNS43ODMsOC44NUg4LjUxMlYyNS4xaDcuMjcxYTEuMiwxLjIsMCwwLDAsMS4xOTQtMS4xOTFWMTAuMDQxQTEuMiwxLjIsMCwwLDAsMTUuNzgzLDguODVaIiBzdHlsZT0ib3BhY2l0eTowLjIwMDAwMDAwMjk4MDIzMjI0O2lzb2xhdGlvbjppc29sYXRlIi8+PHBhdGggZD0iTTE1Ljc4Myw4Ljg1SDguNTEyVjIzLjhoNy4yNzFhMS4yLDEuMiwwLDAsMCwxLjE5NC0xLjE5MVYxMC4wNDFBMS4yLDEuMiwwLDAsMCwxNS43ODMsOC44NVoiIHN0eWxlPSJvcGFjaXR5OjAuMjAwMDAwMDAyOTgwMjMyMjQ7aXNvbGF0aW9uOmlzb2xhdGUiLz48cGF0aCBkPSJNMTUuMTMyLDguODVIOC41MTJWMjMuOGg2LjYyYTEuMiwxLjIsMCwwLDAsMS4xOTQtMS4xOTFWMTAuMDQxQTEuMiwxLjIsMCwwLDAsMTUuMTMyLDguODVaIiBzdHlsZT0ib3BhY2l0eTowLjIwMDAwMDAwMjk4MDIzMjI0O2lzb2xhdGlvbjppc29sYXRlIi8+PHBhdGggZD0iTTMuMTk0LDguODVIMTUuMTMyYTEuMTkzLDEuMTkzLDAsMCwxLDEuMTk0LDEuMTkxVjIxLjk1OWExLjE5MywxLjE5MywwLDAsMS0xLjE5NCwxLjE5MUgzLjE5NEExLjE5MiwxLjE5MiwwLDAsMSwyLDIxLjk1OVYxMC4wNDFBMS4xOTIsMS4xOTIsMCwwLDEsMy4xOTQsOC44NVoiIHN0eWxlPSJmaWxsOnVybCgjYSkiLz48cGF0aCBkPSJNNS43LDE5Ljg3M2wyLjUxMS0zLjg4NC0yLjMtMy44NjJINy43NThMOS4wMTMsMTQuNmMuMTE2LjIzNC4yLjQwOC4yMzguNTI0aC4wMTdjLjA4Mi0uMTg4LjE2OS0uMzY5LjI2LS41NDZsMS4zNDItMi40NDdoMS43bC0yLjM1OSwzLjg0LDIuNDE5LDMuOTA1SDEwLjgyMWwtMS40NS0yLjcxMUEyLjM1NSwyLjM1NSwwLDAsMSw5LjIsMTYuOEg5LjE3NmExLjY4OCwxLjY4OCwwLDAsMS0uMTY4LjM1MUw3LjUxNSwxOS44NzNaIiBzdHlsZT0iZmlsbDojZmZmIi8+PHBhdGggZD0iTTI4LjgwNiwzSDE5LjU4MVY5LjVIMzBWNC4xOTFBMS4xOTIsMS4xOTIsMCwwLDAsMjguODA2LDNaIiBzdHlsZT0iZmlsbDojMzNjNDgxIi8+PHBhdGggZD0iTTE5LjU4MSwxNkgzMHY2LjVIMTkuNTgxWiIgc3R5bGU9ImZpbGw6IzEwN2M0MSIvPjwvc3ZnPg=='
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
  padding: 4px 8
  px; border-radius: 6px; transition: background-color 0.2s;
}
.batch-delete:hover:not(:disabled) { background-color: #fee2e2; }
.batch-delete:disabled { opacity: 0.4; cursor: not-allowed; }

.flex-1 { flex: 1; }

.batches-list::-webkit-scrollbar { width: 4px; }
.batches-list::-webkit-scrollbar-track { background: #f1f3f5; border-radius: 4px; }
.batches-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
</style>