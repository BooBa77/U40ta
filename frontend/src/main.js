import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '../public/css/global.css'
import '../public/css/tailwind.css'
import { useLogger } from './composables/useLogger'

// Сначала создаем приложение
const app = createApp(App)

// Теперь можно использовать app
app.config.errorHandler = (err, instance, info) => {
  const { log } = useLogger();
  log({
    type: 'vue_error',
    message: err.message,
    stack: err.stack,
    info,
    component: instance?.$options?.name,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  });
  
  // Выводим в консоль для разработки
  console.error('Vue error:', err, info);
};

// Перехват ошибок fetch (глобально)
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);
    
    // Логируем только ошибки ответа
    if (!response.ok && args[0] !== '/api/logs') {
      const { log } = useLogger();
      log({
        type: 'api_error',
        url: typeof args[0] === 'string' ? args[0] : args[0].url,
        method: args[1]?.method || 'GET',
        status: response.status,
        statusText: response.statusText,
      });
    }
    
    return response;
  } catch (error) {
    // Сетевые ошибки (нет интернета, CORS и т.д.)
    if (args[0] !== '/api/logs') {
      const { log } = useLogger();
      log({
        type: 'network_error',
        url: typeof args[0] === 'string' ? args[0] : args[0].url,
        message: error.message,
      });
    }
    throw error;
  }
};

// Подключаем роутер и монтируем
app.use(router).mount('#app')