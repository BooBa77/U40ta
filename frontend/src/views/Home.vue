<template>
  <div class="home">
    <!-- АБР в левом верхнем углу -->
    <div class="user-abr" v-if="userAbr">{{ userAbr }}</div>
    
    <!-- Основной контент -->
    <div class="main-content">
      <h1>Добро пожаловать в U40TA!</h1>
      <p>Основной функционал в разработке</p>
      <p v-if="userData.sub">User ID: {{ userData.sub }}</p>
      <p v-if="userData.role">Role: {{ userData.role }}</p>
    </div>

    <!-- PWA и Выход внизу -->
    <div class="bottom-actions">
      <button v-if="showInstallBtn" @click="installPWA" class="pwa-btn">
        Установить приложение
      </button>
      <button @click="logout" class="logout-btn">Выйти</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      userData: { sub: null, role: null }, // из JWT токена
      userAbr: '', // из отдельного запроса
      showInstallBtn: false,
      deferredPrompt: null
    }
  },
  async mounted() {
    this.checkAuth();
    await this.loadUserAbr(); // загружаем абр отдельно
    this.initPWA();
  },
  methods: {
    checkAuth() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        this.$router.push('/login');
        return;
      }
      
      try {
        // Декодируем упрощенный токен (только ID и роль)
        const payloadBase64 = token.split('.')[1];
        const payloadJson = atob(payloadBase64);
        const payload = JSON.parse(payloadJson);
        
        console.log('🔍 Упрощенный токен:', payload);
        
        this.userData = {
          sub: payload.sub,
          role: payload.role
        };
        
      } catch (error) {
        console.error('Ошибка декодирования токена:', error);
        this.$router.push('/login');
      }
    },

    async loadUserAbr() {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const user = await response.json();
          console.log('✅ Данные пользователя:', user);
          this.userAbr = user.abr;
        } else {
          console.error('Ошибка загрузки данных пользователя');
        }
      } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
      }
    },

    initPWA() {
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
        this.deferredPrompt = e;
        
        if (!window.matchMedia('(display-mode: standalone)').matches) {
          this.showInstallBtn = true;
        }
      });

      window.addEventListener('appinstalled', () => {
        this.showInstallBtn = false;
        console.log('PWA installed');
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
    },

    logout() {
      localStorage.removeItem('auth_token');
      this.$router.push('/login');
    }
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: white;
  padding: 20px;
  position: relative;
}

.user-abr {
  position: absolute;
  top: 20px;
  left: 20px;
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.main-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  gap: 20px;
  text-align: center;
}

.bottom-actions {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.pwa-btn {
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  cursor: pointer;
}

.logout-btn {
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  cursor: pointer;
}
</style>