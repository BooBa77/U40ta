<template>
  <div class="qr-scanner">
    <button class="scan-btn" @click="handleScanClick">
      <img src="../../public/images/scan_big.png" alt="Открыть изображение с QR-кодом" class="scan-icon">
    </button>
  </div>
</template>

<script setup>
const handleScanClick = () => {
  console.log('Сканирование QR-кода')
  // Функционал будет добавлен позже
}
</script>

<style scoped>
.qr-scanner {
  display: flex;
  justify-content: center;
  align-items: center;
}

.scan-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  max-width: 50%;
}

.scan-icon {
  width: 100%;
  height: auto;
  display: block;
}
</style>