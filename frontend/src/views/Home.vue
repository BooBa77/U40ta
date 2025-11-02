<template>
  <div class="home">
    <div class="welcome-card">
      <h1>Добро пожаловать в U40TA!</h1>
      <p>Вы успешно авторизованы в системе</p>
      
      <div class="user-info" v-if="userData">
        <h3>Информация о пользователе:</h3>
        <p><strong>ID:</strong> {{ userData.sub }}</p>
        <p><strong>Имя:</strong> {{ userData.first_name }}</p>
        <p><strong>Фамилия:</strong> {{ userData.last_name }}</p>
        <p><strong>Роль:</strong> {{ userData.role }}</p>
      </div>
      
      <div class="token-info">
        <p><strong>Токен:</strong> {{ tokenPreview }}</p>
      </div>

      <button @click="handleLogout" class="logout-btn">Выйти из системы</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      userData: null,
      token: ''
    }
  },
  computed: {
    tokenPreview() {
      if (!this.token) return 'не получен';
      return this.token.substring(0, 20) + '...';
    }
  },
  mounted() {
    this.checkAuth();
  },
  methods: {
    checkAuth() {
      // Получаем токен из localStorage
      this.token = localStorage.getItem('auth_token');
      
      if (!this.token) {
        // Если нет токена - перенаправляем на страницу входа
        this.$router.push('/dev-login');
        return;
      }

      try {
        // Декодируем JWT токен чтобы получить данные пользователя
        const payload = JSON.parse(atob(this.token.split('.')[1]));
        this.userData = payload;
        console.log('Данные пользователя:', payload);
      } catch (error) {
        console.error('Ошибка декодирования токена:', error);
        this.handleLogout();
      }
    },

    handleLogout() {
      // Удаляем токен и перенаправляем на страницу входа
      localStorage.removeItem('auth_token');
      this.$router.push('/dev-login');
    }
  }
}
</script>

<style scoped>
.home {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.welcome-card {
  background: white;
  padding: 2rem;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  text-align: center;
  max-width: 500px;
  width: 100%;
}

.welcome-card h1 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 2rem;
}

.welcome-card p {
  color: #666;
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
}

.user-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  text-align: left;
}

.user-info h3 {
  margin-top: 0;
  color: #333;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 0.5rem;
}

.user-info p {
  margin: 0.5rem 0;
  color: #555;
}

.token-info {
  background: #e3f2fd;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-family: monospace;
  font-size: 0.9rem;
}

.logout-btn {
  background: #ff4757;
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s;
  width: 100%;
}

.logout-btn:hover {
  background: #ff3742;
}
</style>