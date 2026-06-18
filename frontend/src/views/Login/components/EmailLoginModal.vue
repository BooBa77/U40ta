<template>
  <Transition name="modal">
    <div 
      v-if="isOpen" 
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50" 
      @click.self="handleClose"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        
        <!-- Хедер -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900">
            Вход по email
          </h3>
          <button 
            class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            @click="handleClose"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <!-- Контент -->
        <div class="p-6 space-y-4">
          
          <!-- Поле email -->
          <div>
            <label for="email-input" class="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email-input"
              v-model="email"
              type="email"
              placeholder="ivanovii@domain.com"
              :disabled="codeSent"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                     transition-colors"
              @keydown.enter="handleSendCode"
            />
            <p v-if="emailError" class="mt-1 text-sm text-red-600">
              {{ emailError }}
            </p>
          </div>

          <!-- Кнопка отправки кода -->
          <button
            v-if="!codeSent"
            :disabled="!email || isLoading || !isEmailValid"
            class="w-full py-2.5 px-4 bg-blue-500 text-white rounded-lg text-sm font-medium
                   hover:bg-blue-600 active:bg-blue-700 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
            @click="handleSendCode"
          >
            {{ isLoading ? 'Отправка...' : 'Отправить код' }}
          </button>

          <!-- Состояние после отправки кода -->
          <div v-else class="space-y-4">
            
            <!-- Информация об отправке -->
            <div class="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <svg class="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p class="text-sm text-green-800 font-medium">Код отправлен на {{ email }}</p>
                <p class="text-xs text-green-700">Введите код из письма</p>
              </div>
            </div>

            <!-- Поле для кода -->
            <div>
              <label for="code-input" class="block text-sm font-medium text-gray-700 mb-1">
                Код подтверждения
              </label>
              <input
                id="code-input"
                v-model="code"
                type="text"
                inputmode="numeric"
                maxlength="4"
                placeholder="1234"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center text-2xl tracking-[0.5em] font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       transition-colors"
                @keydown.enter="handleVerifyCode"
                autofocus
              />
              <p v-if="codeError" class="mt-1 text-sm text-red-600">
                {{ codeError }}
              </p>
            </div>

            <!-- Кнопка входа -->
            <button
              :disabled="!code || code.length < 4 || isLoading || isVerifying"
              class="w-full py-2.5 px-4 bg-blue-500 text-white rounded-lg text-sm font-medium
                     hover:bg-blue-600 active:bg-blue-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
              @click="handleVerifyCode"
            >
              {{ isVerifying ? 'Проверка...' : 'Войти' }}
            </button>

            <!-- Таймер и повторная отправка -->
            <div class="flex items-center justify-between pt-2">
              <span class="text-sm text-gray-500">
                Код действителен 
                <span class="font-mono font-medium text-gray-700">{{ formattedTime }}</span>
              </span>
              <button
                v-if="timer <= 0"
                class="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                @click="handleResendCode"
              >
                Запросить код подтверждения
              </button>
              <span v-else class="text-sm text-gray-400">
                Повторно через {{ formattedTime }}
              </span>
            </div>
          </div>

          <!-- Ошибка -->
          <p v-if="errorMessage" class="text-sm text-red-600 text-center">
            {{ errorMessage }}
          </p>

          <!-- Разделитель -->
          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-200"></div>
            </div>
            <div class="relative flex justify-center text-xs">
              <span class="px-3 bg-white text-gray-500"></span>
            </div>
          </div>

          <!-- Кнопка назад -->
          <button
            class="w-full py-2.5 px-4 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium
                   hover:bg-gray-200 active:bg-gray-300 transition-colors"
            @click="handleClose"
          >
            Назад к выбору входа
          </button>

        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { emailService } from '@/services/email.service'

export default {
  name: 'EmailLoginModal',
  
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },

  emits: ['close', 'success'],

  setup(props, { emit }) {
    const router = useRouter()

    // ===== Состояние =====
    const email = ref('')
    const code = ref('')
    const isLoading = ref(false)
    const isVerifying = ref(false)
    const codeSent = ref(false)
    const timer = ref(0)
    const emailError = ref('')
    const codeError = ref('')
    const errorMessage = ref('')
    let timerInterval = null

    // ===== Вычисляемые свойства =====
    const isEmailValid = computed(() => {
      if (!email.value) return false
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email.value)
    })

    const formattedTime = computed(() => {
      const mins = Math.floor(timer.value / 60)
      const secs = timer.value % 60
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    })

    // ===== Методы =====

    /**
     * Валидация email
     */
    const validateEmail = () => {
      if (!email.value) {
        emailError.value = 'Введите email'
        return false
      }
      if (!isEmailValid.value) {
        emailError.value = 'Введите корректный email'
        return false
      }
      emailError.value = ''
      return true
    }

    /**
     * Очистка ошибок при вводе
     */
    watch(email, () => {
      if (emailError.value) {
        emailError.value = ''
      }
      if (errorMessage.value) {
        errorMessage.value = ''
      }
    })

    watch(code, () => {
      if (codeError.value) {
        codeError.value = ''
      }
      if (errorMessage.value) {
        errorMessage.value = ''
      }
    })

    /**
     * Запуск таймера
     */
    const startTimer = (seconds) => {
      timer.value = seconds
      if (timerInterval) {
        clearInterval(timerInterval)
      }
      timerInterval = setInterval(() => {
        timer.value -= 1
        if (timer.value <= 0) {
          clearInterval(timerInterval)
          timerInterval = null
        }
      }, 1000)
    }

    /**
     * Отправить код
     */
    const handleSendCode = async () => {
      if (!validateEmail()) return
      if (isLoading.value) return

      isLoading.value = true
      errorMessage.value = ''

      try {
        await emailService.sendCode(email.value)
        codeSent.value = true
        startTimer(300) // 5 минут
        // Автофокус на поле кода
        setTimeout(() => {
          const codeInput = document.getElementById('code-input')
          if (codeInput) codeInput.focus()
        }, 100)
      } catch (error) {
        errorMessage.value = error.message || 'Ошибка отправки кода'
        codeSent.value = false
      } finally {
        isLoading.value = false
      }
    }

    /**
     * Проверить код
     */
    const handleVerifyCode = async () => {
      if (!code.value || code.value.length < 4) {
        codeError.value = 'Введите 4-значный код'
        return
      }
      if (isVerifying.value) return

      isVerifying.value = true
      codeError.value = ''
      errorMessage.value = ''

      try {
        const data = await emailService.verifyCode(email.value, code.value)
        
        // Сохраняем токен
        localStorage.setItem('auth_token', data.access_token)
        
        // Успех
        emit('success')
        
        // Редирект на главную
        router.push('/')
      } catch (error) {
        codeError.value = error.message || 'Неверный код'
        code.value = ''
        // Фокус на поле кода
        setTimeout(() => {
          const codeInput = document.getElementById('code-input')
          if (codeInput) codeInput.focus()
        }, 100)
      } finally {
        isVerifying.value = false
      }
    }

    /**
     * Повторная отправка кода
     */
    const handleResendCode = async () => {
      codeSent.value = false
      code.value = ''
      timer.value = 0
      await handleSendCode()
    }

    /**
     * Закрыть модалку
     */
    const handleClose = () => {
      if (isLoading.value || isVerifying.value) return
      clearInterval(timerInterval)
      timerInterval = null
      // Сброс состояния
      email.value = ''
      code.value = ''
      codeSent.value = false
      timer.value = 0
      emailError.value = ''
      codeError.value = ''
      errorMessage.value = ''
      emit('close')
    }

    /**
     * Восстановление состояния после F5
     * Проверяем, есть ли активный код для email
     */
    const restoreState = async () => {
      const savedEmail = localStorage.getItem('u40ta_email_login')
      if (!savedEmail || !props.isOpen) return

      try {
        const status = await emailService.checkCodeStatus(savedEmail)
        if (status.hasActiveCode) {
          email.value = savedEmail
          codeSent.value = true
          startTimer(status.remainingSeconds)
        } else {
          localStorage.removeItem('u40ta_email_login')
        }
      } catch (error) {
        console.error('[EmailLoginModal] Ошибка восстановления состояния:', error)
        localStorage.removeItem('u40ta_email_login')
      }
    }

    // ===== Жизненный цикл =====
    watch(() => props.isOpen, (newVal) => {
      if (newVal) {
        // Сохраняем email в localStorage для восстановления после F5
        const savedEmail = localStorage.getItem('u40ta_email_login')
        if (savedEmail) {
          email.value = savedEmail
          restoreState()
        }
        // Автофокус на поле email
        setTimeout(() => {
          const emailInput = document.getElementById('email-input')
          if (emailInput) emailInput.focus()
        }, 200)
      }
    })

    // Сохраняем email при его изменении (если код отправлен)
    watch(email, (newVal) => {
      if (newVal && codeSent.value) {
        localStorage.setItem('u40ta_email_login', newVal)
      }
    })

    onUnmounted(() => {
      clearInterval(timerInterval)
      timerInterval = null
    })

    return {
      email,
      code,
      isLoading,
      isVerifying,
      codeSent,
      timer,
      emailError,
      codeError,
      errorMessage,
      isEmailValid,
      formattedTime,
      handleSendCode,
      handleVerifyCode,
      handleResendCode,
      handleClose,
      validateEmail
    }
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-enter-from .bg-white,
.modal-leave-to .bg-white {
  transform: scale(0.95);
  opacity: 0;
}
</style>