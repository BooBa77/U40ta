<template>
  <div class="login-page">
    <div class="login-container">
      
      <h1 class="login-title">Авторизация U40TA</h1>
      
      <!-- ОБЫЧНЫЙ РЕЖИМ -->
      <div v-if="!isPending" class="telegram-btn-container">
        <p class="login-subtitle">Войдите через Telegram для доступа к системе</p>
        <div ref="telegramWidget"></div>
      </div>
      
      <!-- РЕЖИМ ОЖИДАНИЯ -->
      <div v-else class="pending-state">
        <div class="pending-icon">⏳</div>
        <h2 class="pending-title">Заявка принята!</h2>
        <p class="pending-text">
          Ожидайте уведомления в Telegram.<br>
          Когда получите сообщение - обновите страницу.
        </p>
      </div>
      
      <!-- PWA -->
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
import { ref, onMounted } from 'vue'; // ТЕПЕРЬ НУЖНЫ!
import { useRouter } from 'vue-router';

const BOT_USERNAME = 'u40ta_bot';

export default {
  name: 'Login',
  setup() {
    const router = useRouter();
    const telegramWidget = ref(null);
    
    const isPending = ref(false);
    const showInstallBtn = ref(false);
    const deferredPrompt = ref(null);

    const checkAuthStatus = () => {
      const pendingToken = localStorage.getItem('pending_token');
      const authToken = localStorage.getItem('auth_token');
      
      if (authToken) {
        router.push('/');
        return;
      }
      
      if (pendingToken) {
        isPending.value = true;
      }
    };

    const initTelegramWidget = () => {
      if (isPending.value) return;
      
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

      if (telegramWidget.value) {
        telegramWidget.value.innerHTML = '';
        telegramWidget.value.appendChild(script);
      }
    };

    const onTelegramAuth = async (user) => {
      console.log('Telegram auth success:', user);

      if (!user || !user.id) {
        console.error('Invalid user data received');
        return;
      }

      try {
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
          localStorage.setItem('auth_token', data.access_token);
          router.push('/');
        } else if (data.status === 'pending') {
          localStorage.setItem('pending_token', 'true');
          isPending.value = true;
        } else {
          alert('Ошибка авторизации: ' + (data.message || 'Неизвестная ошибка'));
        }
      } catch (error) {
        console.error('Backend error:', error);
        alert('Ошибка соединения с сервером');
      }
    };

    const initPWA = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(() => {
            console.log('Service Worker registered');
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt.value = e;
        
        if (!window.matchMedia('(display-mode: standalone)').matches) {
          showInstallBtn.value = true;
        }
      });

      window.addEventListener('appinstalled', () => {
        showInstallBtn.value = false;
        console.log('PWA installed');
      });
    };

    const installPWA = () => {
      if (deferredPrompt.value) {
        deferredPrompt.value.prompt();
        deferredPrompt.value.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showInstallBtn.value = false;
          }
          deferredPrompt.value = null;
        });
      }
    };

    onMounted(() => {
      checkAuthStatus();
      initPWA();
      initTelegramWidget();
      
      window.onTelegramAuth = onTelegramAuth;
    });

    return {
      isPending,
      showInstallBtn,
      telegramWidget,
      installPWA
    };
  }
}
</script>

<style scoped>
@import url('/css/login.css');
</style>