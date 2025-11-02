<template>
  <div>
    <h1>Вход для разработки</h1>
    
    <!-- Выпадающий список пользователей -->
    <div>
      <label>Выберите пользователя:</label>
      <select v-model="selectedUserId">
        <option value="">-- Выберите пользователя --</option>
        <option v-for="user in users" :key="user.id" :value="user.id">
          {{ user.name }} (ID: {{ user.id }})
        </option>
      </select>
    </div>

    <!-- Кнопка входа -->
    <button @click="login" :disabled="!selectedUserId">
      Войти
    </button>

    <!-- Сообщение об ошибке -->
    <p v-if="error" style="color: red;">{{ error }}</p>
  </div>
</template>

<script>
export default {
  name: 'DevLogin',
  data() {
    return {
      users: [], // Список пользователей
      selectedUserId: '', // ID выбранного пользователя
      error: '' // Сообщение об ошибке
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

      try {
        // Отправляем запрос на бэкенд для получения JWT
        const response = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: this.selectedUserId
          })
        })

        if (response.ok) {
          const data = await response.json()
          
          // Сохраняем токен (например, в localStorage)
          localStorage.setItem('auth_token', data.token)
          
          // Переходим на главную страницу
          this.$router.push('/')
        } else {
          this.error = 'Ошибка авторизации'
        }
      } catch (err) {
        this.error = 'Ошибка соединения с сервером'
      }
    }
  }
}
</script>