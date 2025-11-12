<template>
  <div id="app">
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: 'App',
  mounted() {
    // Слушаем сообщения от Service Worker для автоматического обновления
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('🔄 Обнаружена новая версия PWA, перезагружаемся...');
          // Даём секунду на завершение операций и перезагружаемся
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      });
    }
  }
}
</script>