<template>
  <div class="login-page">
    <div class="login-container">
      
      <!-- ЗАГОЛОВОК -->
      <h1 class="login-title">Авторизация U40TA</h1>
      
      <!-- ОБЫЧНЫЙ РЕЖИМ: Telegram кнопка -->
      <div v-if="!isPending" class="telegram-btn-container">
        <p class="login-subtitle">Войдите через Telegram для доступа к системе</p>
        <button class="telegram-btn" @click="initTelegramWidget">
          Авторизация через Telegram
        </button>
        <!-- Виджет Telegram будет вставлен сюда -->
        <div ref="telegramWidget"></div>
      </div>
      
      <!-- РЕЖИМ ОЖИДАНИЯ: Текст без кнопки -->
      <div v-else class="pending-state">
        <div class="pending-icon">⏳</div>
        <h2 class="pending-title">Заявка принята!</h2>
        <p class="pending-text">
          Ожидайте уведомления в Telegram.<br>
          Когда получите сообщение - обновите страницу.
        </p>
      </div>
      
      <!-- КНОПКА УСТАНОВКИ PWA (скрыта в PWA режиме) -->
      <div v-if="showInstallBtn" class="pwa-section">
        <button class="install-btn" @click="installPWA">
          Установить приложение
        </button>
        <p class="pwa-status">Для удобства использования</p>
      </div>
      
    </div>
  </div>
</template>

<script>
// Константа с именем бота для Telegram Widget
const BOT_USERNAME = 'u40ta_bot';

export default {
  name: 'Login',
  data() {
    return {
      isPending: false,          // Флаг режима ожидания одобрения
      showInstallBtn: false,     // Показывать кнопку установки PWA
      deferredPrompt: null       // Событие установки PWA
    }
  },
  mounted() {
    // Проверяем статус при загрузке страницы
    this.checkAuthStatus();
    // Инициализируем PWA функционал
    this.initPWA();
    
    // Глобальная функция для callback Telegram Widget
    window.onTelegramAuth = (user) => {
      this.onTelegramAuth(user);
    };
  },
  methods: {
    /**
     * Проверяем статус авторизации при загрузке страницы
     * Если есть pending-токен - показываем режим ожидания
     * Если есть рабочий токен - редирект на главную
     */
    checkAuthStatus() {
      const pendingToken = localStorage.getItem('pending_token');
      const authToken = localStorage.getItem('auth_token');
      
      if (authToken) {
        // Уже авторизован - переходим на главную
        this.$router.push('/');
        return;
      }
      
      if (pendingToken) {
        // Есть pending-токен - показываем режим ожидания
        this.isPending = true;
      }
    },

    /**
     * Инициализация Telegram Widget по клику на кнопку
     * Создает и вставляет скрипт Telegram Widget
     */
    initTelegramWidget() {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-auth-url', '/api/auth/telegram');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'true');
      script.setAttribute('data-radius', '20');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;

      // Очищаем контейнер и вставляем скрипт
      this.$refs.telegramWidget.innerHTML = '';
      this.$refs.telegramWidget.appendChild(script);
    },

    /**
     * Обработка успешной авторизации через Telegram
     * Получает данные пользователя и отправляет на бэкенд
     */
    async onTelegramAuth(user) {
      console.log('Telegram auth success:', user);

      if (!user || !user.id) {
        console.error('Invalid user data received');
        return;
      }

      try {
        // Отправляем данные на бэкенд
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(user)
        });

        const data = await response.json();
        console.log('Backend response:', data);

        if (data.status === 'success' && data.access_token) {
          // Успешная авторизация - сохраняем токен и переходим на главную
          localStorage.setItem('auth_token', data.access_token);
          this.$router.push('/');
        } else if (data.status === 'pending') {
          // Режим ожидания - сохраняем pending-токен и показываем соответствующий экран
          localStorage.setItem('pending_token', 'true');
          this.isPending = true;
        } else {
          // Ошибка авторизации
          alert('Ошибка авторизации: ' + (data.message || 'Неизвестная ошибка'));
        }
      } catch (error) {
        console.error('Backend error:', error);
        alert('Ошибка соединения с сервером');
      }
    },

    /**
     * Инициализация PWA функционала
     * Регистрирует Service Worker и настраивает установку
     */
    initPWA() {
      // Регистрируем Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(() => {
            console.log('Service Worker registered');
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }

      // Слушаем событие предложения установки PWA
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        
        // Показываем кнопку установки только если НЕ в PWA режиме
        if (!window.matchMedia('(display-mode: standalone)').matches) {
          this.showInstallBtn = true;
        }
      });

      // Скрываем кнопку после установки
      window.addEventListener('appinstalled', () => {
        this.showInstallBtn = false;
        console.log('PWA installed');
      });
    },

    /**
     * Установка PWA приложения
     * Использует отложенное событие установки
     */
    installPWA() {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            this.showInstallBtn = false;
          }
          this.deferredPrompt = null;
        });
      }
    }
  }
}
</script>

<style scoped>
/* Импортируем CSS стили */
@import url('/css/login.css');
</style>