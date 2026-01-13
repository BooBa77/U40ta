<template>
  <div>
    <h1>Тестирование StatementService</h1>
    <div v-if="loading">Загрузка...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <p>Загружено записей: {{ testData.length }}</p>
      <pre>{{ testData.slice(0, 3) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { statementService } from './services/statement.service'

const route = useRoute()
const loading = ref(false)
const error = ref('')
const testData = ref([])

onMounted(async () => {
  const attachmentId = route.params.attachmentId
  if (!attachmentId) {
    error.value = 'Нет attachmentId в параметрах маршрута'
    return
  }

  loading.value = true
  try {
    console.log('Начинаем загрузку ведомости:', attachmentId)
    console.log('Режим полёта:', statementService.isFlightMode())
    
    const data = await statementService.fetchStatement(attachmentId)
    testData.value = data
    
    console.log('Данные получены:', data.length, 'записей')
    console.log('Первая запись:', data[0])
    
  } catch (err) {
    error.value = err.message
    console.error('Ошибка загрузки:', err)
  } finally {
    loading.value = false
  }
})
</script>