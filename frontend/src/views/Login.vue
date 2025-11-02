<template>
  <div class="login-page">
    <div class="login-container">
      <h1>Авторизация U40TA</h1>
      <p>Войдите через Telegram для доступа к системе</p>
      
      <!-- Кнопка Telegram Widget -->
      <div class="telegram-btn" ref="telegramWidget"></div>
      
      <!-- Fallback кнопка если виджет не загрузился -->
      <button 
        v-if="showFallbackBtn" 
        @click="initTelegramWidget" 
        class="fallback-btn"
      >
        Авторизоваться через Telegram
      </button>

      <!-- Информация о пользователе -->
      <div v-if="userData" class="user-data">
        <h3>Данные пользователя:</h3>
        <pre>{{ userData }}</pre>
        <button @click="logout" class="logout-btn">Выйти</button>
      </div>

      <!-- Статус PWA -->
      <div class="pwa-status">
        <p id="pwa-status-text">{{ pwaStatus }}</p>
        <button 
          v-if="showInstallBtn" 
          @click="installPWA" 
          id="install-btn" 
          class="install-btn"
        >
          Установить приложение
        </button>
      </div>
    </div>
  </div>
</template>

<script>
const BOT_USERNAME = 'u40ta_bot';

export default {
  name: 'Login',
  data() {
    return {
      userData: null,
      showFallbackBtn: false,
      pwaStatus: 'Проверка PWA...',
      showInstallBtn: false,
      deferredPrompt: null
    }
  },
  mounted() {
    this.checkSavedSession();
    this.initTelegramWidget();
    this.initPWA();
    
    // Проверяем загрузился ли виджет
    setTimeout(() => {
      if (!this.$refs.telegramWidget.children.length) {
        this.showFallbackBtn = true;
      }
    }, 2000);
  },
  methods: {
    // Инициализация Telegram Widget
    initTelegramWidget() {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-onauth', 'window.handleTelegramAuth');
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'true');
      script.setAttribute('data-radius', '20');
      script.async = true;

      this.$refs.telegramWidget.innerHTML = '';
      this.$refs.telegramWidget.appendChild(script);

      // Глобальная функция для обработки авторизации
      window.handleTelegramAuth = (user) => {
        this.onTelegramAuth(user);
      };
    },

    // Обработка успешной авторизации Telegram
    async onTelegramAuth(user) {
      console.log('Telegram auth success:', user);

      if (!user || !user.id) {
        console.error('Invalid user data received');
        return;
      }

      // Сохраняем данные пользователя
      localStorage.setItem('telegram_user', JSON.stringify(user));
      localStorage.setItem('telegram_auth_date', Date.now().toString());

      // Отображаем данные
      this.userData = {
        id: user.id,
        first_name: user.first_name || 'Не указано',
        last_name: user.last_name || 'Не указано',
        username: user.username || 'Не указан',
        auth_date: new Date(user.auth_date * 1000).toLocaleString('ru-RU')
      };

      // Отправляем данные на бэкенд
      await this.sendToBackend(user);
    },

    // Отправка данных на бэкенд
    async sendToBackend(userData) {
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(userData)
        });

        const data = await response.json();
        console.log('Backend response:', data);

        if (data.status === 'success' && data.access_token) {
          // Сохраняем JWT токен
          localStorage.setItem('auth_token', data.access_token);
          
          // Перенаправляем на главную страницу
          this.$router.push('/');
        } else if (data.status === 'pending') {
          alert('Ваша заявка на рассмотрении. Ожидайте одобрения администратором.');
        } else {
          alert('Ошибка авторизации: ' + (data.message || 'Неизвестная ошибка'));
        }
      } catch (error) {
        console.error('Backend error:', error);
        alert('Ошибка соединения с сервером');
      }
    },

    // Проверка сохраненной сессии
    checkSavedSession() {
      const savedUser = localStorage.getItem('telegram_user');
      const authDate = localStorage.getItem('telegram_auth_date');

      if (savedUser && authDate) {
        const hoursDiff = (Date.now() - parseInt(authDate)) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          const user = JSON.parse(savedUser);
          this.userData = {
            id: user.id,
            first_name: user.first_name || 'Не указано',
            last_name: user.last_name || 'Не указано',
            username: user.username || 'Не указан'
          };
          console.log('Restored user session:', user);
        } else {
          this.logout();
        }
      }
    },

    // Выход из системы
    logout() {
      localStorage.removeItem('telegram_user');
      localStorage.removeItem('telegram_auth_date');
      localStorage.removeItem('auth_token');
      this.userData = null;
      console.log('User logged out');
    },

    // PWA функциональность
    initPWA() {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(() => {
            this.pwaStatus = 'PWA: ✅ Готов к установке';
            
            if (window.matchMedia('(display-mode: standalone)').matches) {
              this.pwaStatus = 'PWA: ✅ Запущено как приложение';
              this.showInstallBtn = false;
            }
          })
          .catch(() => {
            this.pwaStatus = 'PWA: ⚠️ Service Worker не зарегистрирован';
          });
      } else {
        this.pwaStatus = 'PWA: ❌ Не поддерживается';
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        this.showInstallBtn = true;
      });

      window.addEventListener('appinstalled', () => {
        this.showInstallBtn = false;
        this.pwaStatus = 'PWA: ✅ Установлено как приложение';
      });
    },

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
.login-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  background: white;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.login-container h1 {
  color: #333;
  margin-bottom: 1rem;
}

.login-container p {
  color: #666;
  margin-bottom: 2rem;
}

.telegram-btn {
  margin-bottom: 1rem;
}

.fallback-btn, .logout-btn, .install-btn {
  background: #0088cc;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1rem;
  margin: 0.5rem;
  width: 100%;
}

.fallback-btn:hover, .logout-btn:hover, .install-btn:hover {
  background: #0077b3;
}

.user-data {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin: 1rem 0;
  text-align: left;
}

.user-data pre {
  white-space: pre-wrap;
  font-size: 0.9rem;
}

.pwa-status {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.pwa-status p {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
</style>