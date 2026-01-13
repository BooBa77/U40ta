<template>
  <div class="statement-page">
    <h1>Ведомость #{{ attachmentId }}</h1>
    
    <!-- Загрузка -->
    <div v-if="isLoading">
      Загрузка ведомости...
    </div>
    
    <!-- Ошибка -->
    <div v-if="errorMessage" class="error">
      {{ errorMessage }}
      <button @click="loadStatement">Повторить</button>
    </div>
    
    <!-- Данные -->
    <div v-if="!isLoading && !errorMessage">
      <p>Загружено строк: {{ statements.length }}</p>
      <!-- Позже здесь будет таблица -->
    </div>
    
    <button @click="$router.push('/')">← Назад</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const attachmentId = route.params.id

const statements = ref([])
const isLoading = ref(true)
const errorMessage = ref('')

const loadStatement = async () => {
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    const response = await fetch(`/api/statements/${attachmentId}`)
    
    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}`)
    }
    
    const data = await response.json()
    statements.value = data.statements
    
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadStatement()
})
</script>