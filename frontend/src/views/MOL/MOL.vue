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
      <h1 class="text-lg font-semibold text-gray-800">Утилиты МОЛ</h1>
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
              <th class="bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200 w-[40px] text-center">
                №
              </th>
              <th class="bg-gray-50 px-2 py-3 text-left font-semibold text-gray-800 border-b-2 border-gray-200">
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
              <td class="px-2 py-3 border-b border-gray-100 text-center text-gray-500 font-medium">
                {{ index + 1 }}
              </td>
              <td class="px-2 py-3 border-b border-gray-100 text-gray-600">
                <div class="font-medium">{{ change.description }}</div>
                <div v-if="change.details" class="text-xs text-gray-400 mt-0.5">
                  {{ change.details }}
                </div>
              </td>
              <td class="px-2 py-3 border-b border-gray-100 text-center">
                <div class="flex gap-2 justify-center">
                  <button 
                    @click="handleDecision(change.id, 'approved')"
                    :disabled="change.decision !== null"
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
                    :disabled="change.decision !== null"
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

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

// ============================================================================
// ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
// ============================================================================

/** Есть ли хотя бы одно решение */
const hasDecisions = computed(() => {
  return proposedChanges.value.some(change => change.decision !== null)
})

// ============================================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================================

/**
 * Загрузка предлагаемых изменений из БД
 */
const loadProposedChanges = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    // TODO: заменить на реальный API-запрос
    // const response = await fetch('/api/proposed-changes')
    // const data = await response.json()
    // proposedChanges.value = data.map(change => ({ ...change, decision: null }))
    
    // Временные тестовые данные
    await new Promise(resolve => setTimeout(resolve, 500))
    proposedChanges.value = [
      {
        id: 1,
        description: 'Перемещение ноутбука HP EliteBook',
        details: 'Из каб. 301 в каб. 405',
        decision: null
      },
      {
        id: 2,
        description: 'Списание монитора Dell U2419H',
        details: 'Инв. № 456789, причина: неисправен',
        decision: null
      },
      {
        id: 3,
        description: 'Вовлечение нового МФУ Kyocera',
        details: 'В каб. 202, от поставщика ООО "Техника"',
        decision: null
      }
    ]
  } catch (e) {
    error.value = 'Ошибка загрузки данных'
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

// ============================================================================
// ОБРАБОТЧИКИ
// ============================================================================

/**
 * Обработчик принятия решения (Да/Нет)
 */
const handleDecision = (changeId, decision) => {
  const change = proposedChanges.value.find(c => c.id === changeId)
  if (change && change.decision === null) {
    change.decision = decision
  }
}

/**
 * Сохранение всех решений
 */
const handleSaveDecisions = async () => {
  if (!hasDecisions.value || isSaving.value) return
  
  isSaving.value = true
  
  try {
    const decisions = proposedChanges.value
      .filter(change => change.decision !== null)
      .map(change => ({
        id: change.id,
        decision: change.decision
      }))
    
    // TODO: заменить на реальный API-запрос
    // await fetch('/api/proposed-changes/decisions', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ decisions })
    // })
    
    console.log('Сохранённые решения:', decisions)
    
    // Успешно сохранили — можно обновить список или показать уведомление
    await loadProposedChanges()
    
  } catch (e) {
    error.value = 'Ошибка сохранения решений'
    console.error(e)
  } finally {
    isSaving.value = false
  }
}

// ============================================================================
// ЖИЗНЕННЫЙ ЦИКЛ
// ============================================================================

onMounted(() => {
  loadProposedChanges()
})
</script>