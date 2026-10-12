import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '../public/css/global.css'
import '../public/css/tailwind.css'

// Сначала создаем приложение
const app = createApp(App)

// Ошибки приложения и запросов идут в консоль браузера.
//
// Раньше здесь стоял useLogger(), который отправлял их в таблицу `logs` через
// POST /api/logs. Технические записи из базы убраны 12.10.2026: читать их было
// некому, а таблица росла. В базе остаётся только бизнес-история — изменения
// объекта, QR-кода и фотографии, её пишет services/logs.service.js.
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err, info);
};

// Перехват ошибок fetch (глобально)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);

    // Логируем только ошибки ответа
    if (!response.ok) {
      console.error('Ошибка запроса:', response.status, response.statusText, args[0]);
    }

    return response;
  } catch (error) {
    // Сетевые ошибки (нет интернета, CORS и т.д.)
    console.error('Сетевая ошибка:', error.message, args[0]);
    throw error;
  }
};

// Подключаем роутер и монтируем
app.use(router).mount('#app')
