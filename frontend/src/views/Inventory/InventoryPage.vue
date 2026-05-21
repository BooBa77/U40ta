<template>
  <div class="inventory-page">
    <!-- Хедер -->
    <header class="inventory-header">
      <button class="back-button" @click="goBack">
        ← Назад
      </button>
      <h1 class="inventory-title">{{ book?.name || 'Загрузка...' }}</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Основной контент -->
    <main class="inventory-main">
      <!-- Таблица строк будет здесь -->
      <div class="placeholder-content">
        Строки книги
      </div>
    </main>

    <!-- Футер -->
    <footer class="inventory-footer">
      <QrScannerButton 
        size="medium" 
        @scan="handleQrScan"
        @error="handleScanError"
      />
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import QrScannerButton from '@/components/QrScanner/ui/QrScannerButton.vue'
import { inventoryBookService } from '@/services/inventory-book.service'
import { useSSE } from '@/composables/useSSE'

const router = useRouter()
const route = useRoute()

const bookId = Number(route.params.id)
const book = ref(null)

const goBack = () => {
  router.push('/')
}

const handleQrScan = async (qrCode) => {
  console.log('InventoryPage: QR-скан:', qrCode)
}

const handleScanError = (error) => {
  console.error('InventoryPage: ошибка сканирования:', error)
}

const checkAccessAndReload = async () => {
  try {
    book.value = await inventoryBookService.getBook(bookId)
  } catch (error) {
    if (error.message.includes('403') || error.message.includes('Нет доступа')) {
      router.push('/')
    }
  }
}

// SSE — слушаем изменения книги
useSSE((data) => {
  if (data.type === 'inventory-book-changed' && data.data?.bookId === bookId) {
    checkAccessAndReload()
  }
})

onMounted(async () => {
  try {
    book.value = await inventoryBookService.getBook(bookId)
  } catch (error) {
    console.error('Ошибка загрузки книги:', error)
    router.push('/')
  }
})
</script>

<style scoped>
@import './InventoryPage.css';
</style>