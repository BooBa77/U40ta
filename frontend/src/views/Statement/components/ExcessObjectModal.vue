<template>
  <Transition name="modal">
    <div v-if="isOpen" class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50" @click.self="handleBack">
      <div class="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden" style="width: 500px; max-width: 90vw; max-height: 85vh;">
        
        <!-- Хедер -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 class="text-lg font-semibold text-gray-900">
            Объект вне ведомости
          </h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400
                   active:bg-gray-100 active:text-gray-900"
            @click="handleBack"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <!-- Контент -->
        <div class="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
          <!-- Состояние загрузки -->
          <div v-if="isLoading" class="py-10 text-center text-gray-500">
            Загрузка данных...
          </div>

          <!-- Состояние ошибки -->
          <div v-else-if="error" class="py-10 text-center text-red-600">
            {{ error }}
          </div>

          <!-- Данные объекта -->
          <template v-else>
            <!-- Информация об объекте -->
            <div class="leading-[1.3]">
              <div class="text-[15px] font-medium text-gray-800 mb-0.5">
                {{ object.buhName || '—' }}
              </div>
              <div class="text-sm text-gray-500 mb-0.5">
                {{ object.invNumber || '—' }}
              </div>
              <div class="text-[13px] text-gray-400">
                Склад — {{ object.sklad }}/{{ object.zavod }}
              </div>
              <div v-if="object.partyNumber" class="text-[13px] text-gray-400">
                Партия — {{ object.partyNumber }}
              </div>
            </div>

            <!-- Вовлечение в производство -->
            <div 
              v-if="involveDetected" 
              class="p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex flex-col gap-2"
            >
              <p class="text-sm text-yellow-800">
                Вероятно произошло вовлечение в производство, смена партии {{ involveFromParty }} на {{ involveParty }}.
              </p>
              <button 
                class="w-full py-2.5 bg-yellow-500 text-white rounded-md text-sm font-medium
                       active:bg-yellow-600 disabled:opacity-50"
                :disabled="isSaving"
                @click="handleInvolve"
              >
                Заменить партию в базе?
              </button>
            </div>

            <!-- Перемещение на другой склад -->
            <div class="flex flex-col gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
              <div class="text-sm font-medium text-gray-700 mb-1">
                Переместить на другой склад
              </div>

              <!-- Завод -->
              <div>
                <input
                  type="text"
                  v-model="selectedZavod"
                  placeholder="Завод"
                  class="input-base"
                  list="zavod-options"
                  :disabled="isSaving || combinationsLoading"
                  @input="onZavodChange"
                />
                <datalist id="zavod-options">
                  <option v-for="opt in zavodOptions" :key="opt" :value="String(opt)" />
                </datalist>
              </div>

              <!-- Склад -->
              <div>
                <input
                  type="text"
                  v-model="selectedSklad"
                  placeholder="Склад"
                  class="input-base"
                  list="sklad-options"
                  :disabled="isSaving || combinationsLoading"
                />
                <datalist id="sklad-options">
                  <option v-for="opt in skladOptions" :key="opt" :value="opt" />
                </datalist>
              </div>

              <div v-if="combinationsLoading" class="text-[13px] text-gray-500 italic py-1">
                Загрузка вариантов...
              </div>
            </div>

            <!-- Ошибка сохранения -->
            <div 
              v-if="saveError" 
              class="text-sm text-red-600 p-3 bg-red-50 rounded-lg border-l-4 border-red-600"
            >
              {{ saveError }}
            </div>
          </template>
        </div>

        <!-- Футер -->
        <div class="flex gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button 
            @click="handleBack"
            class="flex-1 py-2.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium
                   hover:bg-gray-300 transition disabled:opacity-50"
            :disabled="isSaving"
          >
            ← Назад
          </button>
          <button 
            @click="handleMove"
            class="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium
                   hover:bg-blue-600 transition disabled:opacity-50"
            :disabled="isSaving || !canMove"
          >
            {{ isSaving ? 'Сохранение...' : 'Переместить' }}
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup>
/**
 * Модалка для работы с объектом, отсутствующим в ведомости (isExcess).
 * 
 * ## Возможности
 * - Вовлечение в производство: если party начинается с 'MAS' и в statements
 *   есть записи с тем же inv, но другой партией — предлагает заменить партию.
 * - Перемещение на другой склад: смена zavod/sklad у объекта.
 */
import { ref, computed, watch } from 'vue'
import { objectService } from '@/services/object.service.js'
import { statementService } from '@/services/statement.service.js'
import { logsService } from '@/services/logs.service.js'

const props = defineProps({
  /**
   * Флаг открытия модалки
   */
  isOpen: {
    type: Boolean,
    required: true
  },
  /**
   * ID объекта
   */
  objectId: {
    type: [Number, String],
    required: true
  },
  /**
   * Дата получения ведомости (для поиска в текущей ведомости)
   */
  receivedAt: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['back', 'saved'])

// ============ СОСТОЯНИЯ ============
const isLoading = ref(false)
const error = ref('')
const isSaving = ref(false)
const saveError = ref('')

const object = ref({
  id: null,
  invNumber: '',
  buhName: '',
  sklad: '',
  zavod: 0,
  partyNumber: ''
})

// Вовлечение в производство
const involveDetected = ref(false)
const involveParty = ref('')
const involveFromParty = ref('')

// Комбинации складов
const combinations = ref([])
const combinationsLoading = ref(false)

// Выбранные завод и склад
const selectedZavod = ref('')
const selectedSklad = ref('')

// ============ COMPUTED ============

/**
 * Можно ли вовлечь в производство.
 * Первое условие: партия начинается с 'MAS'.
 */
const canInvolve = computed(() => {
  const party = object.value.partyNumber || ''
  return party.toUpperCase().startsWith('MAS')
})

/**
 * Уникальные заводы из комбинаций.
 */
const zavodOptions = computed(() => {
  const zavods = new Set(combinations.value.map(c => c.zavod))
  return Array.from(zavods).sort((a, b) => a - b)
})

/**
 * Склады, отфильтрованные по выбранному заводу.
 */
const skladOptions = computed(() => {
  if (!selectedZavod.value) {
    return combinations.value.map(c => c.sklad).sort()
  }
  const zavodNum = Number(selectedZavod.value)
  return combinations.value
    .filter(c => c.zavod === zavodNum)
    .map(c => c.sklad)
    .sort()
})

/**
 * Можно ли выполнить перемещение.
 */
const canMove = computed(() => {
  if (!selectedZavod.value || !selectedSklad.value) return false
  
  const zavodNum = Number(selectedZavod.value)
  if (isNaN(zavodNum)) return false
  
  return zavodNum !== object.value.zavod || selectedSklad.value !== object.value.sklad
})

// ============ МЕТОДЫ ============

/**
 * Загрузка данных объекта.
 */
const loadObject = async () => {
  isLoading.value = true
  error.value = ''
  
  try {
    const data = await objectService.getObject(props.objectId)
    object.value = {
      id: data.id,
      invNumber: data.invNumber || '',
      buhName: data.buhName || '',
      sklad: data.sklad || '',
      zavod: data.zavod || 0,
      partyNumber: data.partyNumber || ''
    }
  } catch (err) {
    error.value = err.message || 'Ошибка загрузки объекта'
  } finally {
    isLoading.value = false
  }
}

/**
 * Загрузка комбинаций складов.
 */
const loadCombinations = async () => {
  combinationsLoading.value = true
  
  try {
    combinations.value = await objectService.getSkladCombinations()
  } catch (err) {
    console.error('[ExcessObjectModal] Ошибка загрузки комбинаций:', err)
  } finally {
    combinationsLoading.value = false
  }
}

/**
 * Проверка возможности вовлечения в производство.
 * 
 * Условия:
 * 1. Партия начинается с 'MAS'
 * 2. В statements есть запись с тем же inv, но другой партией
 */
const checkInvolve = async () => {
  if (!canInvolve.value) return
  if (!props.receivedAt) return
  
  try {
    const statements = await statementService.getStatementsByInv(
      props.receivedAt,
      object.value.invNumber,
      null,
      object.value.zavod,
      object.value.sklad
    )

    const objects = await objectService.getObjectsByInv(
      object.value.invNumber,
      null,
      object.value.zavod,
      object.value.sklad
    )
    
    if (statements.length === 0 || objects.length === 0) return
    
    const objectParties = new Set(objects.map(o => o.partyNumber || ''))
    const newStatement = statements.find(s => !objectParties.has(s.partyNumber || ''))
    
    if (newStatement && newStatement.partyNumber !== object.value.partyNumber) {
      involveParty.value = newStatement.partyNumber
      involveFromParty.value = object.value.partyNumber
      involveDetected.value = true
    }
  } catch (err) {
    console.error('[ExcessObjectModal] Ошибка проверки вовлечения:', err)
  }
}

/**
 * Сброс выбранного склада при смене завода.
 */
const onZavodChange = () => {
  const zavodNum = Number(selectedZavod.value)
  if (isNaN(zavodNum)) {
    selectedSklad.value = ''
    return
  }
  
  const validSklads = combinations.value
    .filter(c => c.zavod === zavodNum)
    .map(c => c.sklad)
  
  if (!validSklads.includes(selectedSklad.value)) {
    selectedSklad.value = ''
  }
}

/**
 * Вовлечение в производство — замена партии у объекта.
 */
const handleInvolve = async () => {
  isSaving.value = true
  saveError.value = ''
  
  try {
    await objectService.updateObject(object.value.id, {
      partyNumber: involveParty.value
    })
    
    await logsService.addObjectHistory(
      object.value.id,
      'party_changed',
      `партия изменена с ${involveFromParty.value} на ${involveParty.value} (вовлечение в производство)`
    )
    await objectService.updateCheckedAt(object.value.id)
    
    emit('saved')
    handleBack()
  } catch (err) {
    saveError.value = err.message || 'Ошибка замены партии'
  } finally {
    isSaving.value = false
  }
}

/**
 * Перемещение объекта на новый склад.
 */
const handleMove = async () => {
  isSaving.value = true
  saveError.value = ''
  
  try {
    const zavodNum = Number(selectedZavod.value)
    
    await objectService.updateObject(object.value.id, {
      zavod: zavodNum,
      sklad: selectedSklad.value
    })
    
    await logsService.addObjectHistory(
      object.value.id,
      'place_changed',
      `перемещён со склада ${object.value.sklad}/${object.value.zavod} на ${selectedSklad.value}/${zavodNum}`
    )
    await objectService.updateCheckedAt(object.value.id)
    
    emit('saved')
    handleBack()
  } catch (err) {
    saveError.value = err.message || 'Ошибка перемещения'
  } finally {
    isSaving.value = false
  }
}

/**
 * Закрытие модалки.
 */
const handleBack = () => {
  emit('back')
}

// ============ WATCH ============
watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    isLoading.value = true
    
    await Promise.all([
      loadObject(),
      loadCombinations()
    ])
    
    await checkInvolve()
    
    isLoading.value = false
  } else {
    object.value = {
      id: null,
      invNumber: '',
      buhName: '',
      sklad: '',
      zavod: 0,
      partyNumber: ''
    }
    selectedZavod.value = ''
    selectedSklad.value = ''
    involveDetected.value = false
    involveParty.value = ''
    involveFromParty.value = ''
    saveError.value = ''
    error.value = ''
  }
}, { immediate: true })
</script>

<style scoped>
.input-base {
  @apply w-full px-3 py-2.5 border border-gray-300 rounded-md text-[15px] 
         bg-white disabled:bg-gray-100 disabled:text-gray-400;
}

input[list] {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}

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