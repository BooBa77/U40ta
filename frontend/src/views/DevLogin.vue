<template>
  <div class="dev-login">
    <h1>Вход для разработки</h1>
    
    <!-- Выпадающий список пользователей -->
    <div class="user-selection">
      <label>Выберите пользователя:</label>
      <select v-model="selectedUserId">
        <option value="">-- Выберите пользователя --</option>
        <option v-for="user in users" :key="user.id" :value="user.id">
          Пользователь #{{ user.id }}
        </option>
      </select>
    </div>

    <!-- Кнопка входа -->
    <button @click="login" :disabled="!selectedUserId" class="login-btn">
      Войти
    </button>

    <!-- Сообщения -->
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="loading">Выполняется вход...</div>
  </div>
</template>

<script>
export default {
  name: 'DevLogin',
  data() {
    return {
      users: [], // Список пользователей
      selectedUserId: '', // ID выбранного пользователя
      error: '', // Сообщение об ошибке
      loading: false // Флаг загрузки
    }
  },
  async mounted() {
    // Загружаем список пользователей при загрузке страницы
    await this.loadUsers()
  },
  methods: {
    // Метод для загрузки списка пользователей
    async loadUsers() {
      try {
        const response = await fetch('/api/users')
        if (response.ok) {
          this.users = await response.json()
        } else {
          this.error = 'Ошибка загрузки пользователей'
        }
      } catch (err) {
        this.error = 'Ошибка соединения с сервером'
      }
    },

    // Метод для входа выбранного пользователя
    async login() {
      if (!this.selectedUserId) return

      this.loading = true
      this.error = ''

      try {
        // Отправляем запрос на бэкенд для получения JWT
        const response = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: parseInt(this.selectedUserId)
          })
        })

        if (response.ok) {
          const data = await response.json()
          
          // Сохраняем токен в localStorage
          localStorage.setItem('auth_token', data.access_token)
          
          // Просто перенаправляем на главную страницу
          // Home.vue сам проверит авторизацию и получит данные пользователя
          this.$router.push('/')
        } else {
          const errorData = await response.json()
          this.error = errorData.message || 'Ошибка авторизации'
        }
      } catch (err) {
        this.error = 'Ошибка соединения с сервером'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.dev-login {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  text-align: center;
}

.user-selection {
  margin: 20px 0;
}

select {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.login-btn {
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.login-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.login-btn:not(:disabled):hover {
  background: #0056b3;
}

.error {
  margin: 20px 0;
  padding: 10px;
  background-color: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
}

.loading {
  margin: 20px 0;
  padding: 10px;
  background-color: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
  border-radius: 4px;
}
</style>