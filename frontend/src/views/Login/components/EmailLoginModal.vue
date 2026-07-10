<!-- frontend/src/views/Login/components/EmailLoginModal.vue -->

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
          
          <!-- Поле email с подсказкой домена -->
          <div>
            <label for="email-input" class="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <!--
            <div class="relative">
              <input
                id="email-input"
                v-model="emailLocalPart"
                type="text"
                placeholder="логин"
                :disabled="codeSent"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                       transition-colors"
                @input="validateEmailLocalPart"
                @keydown.enter="handleSendCode"
                autofocus
              />
              <span 
                class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none transition-opacity duration-200"
                :class="{ 'opacity-0': emailLocalPart.length > 0 }"
              >
                @irkutsk-dobycha.gazprom.ru
              </span>
            </div>
            -->
            <div class="relative">
              <input
                id="email-input"
                v-model="emailLocalPart"
                type="text"
                placeholder="логин"
                :disabled="codeSent"
                class="w-full px-4 py-2.5 pr-52 border border-gray-300 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                      transition-colors"
                @input="validateEmailLocalPart"
                @keydown.enter="handleSendCode"
              />
              <!-- Домен всегда виден справа -->
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none select-none">
                @irkutsk-dobycha.gazprom.ru
              </span>
            </div>            
            <p v-if="emailError" class="mt-1 text-sm text-red-600">
              {{ emailError }}
            </p>
            <p class="mt-1 text-xs text-gray-400">
              Введите логин, домен подставится автоматически
            </p>
          </div>

          <!-- Кнопка отправки кода -->
          <button
            v-if="!codeSent"
            :disabled="!fullEmail || isLoading || !isEmailValid"
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
                <p class="text-sm text-green-800 font-medium">Код отправлен на {{ fullEmail }}</p>
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
                class="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-center text-2xl tracking-[0.5em] font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       transition-colors"
                @keydown.enter="handleVerifyCode"
                @input="validateCode"
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
                class="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium
                       hover:bg-blue-100 active:bg-blue-200 transition-colors"
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
              <span class="px-3 bg-white text-gray-500">или</span>
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

const CORPORATE_DOMAIN = 'irkutsk-dobycha.gazprom.ru'

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
    const emailLocalPart = ref('')
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
    const fullEmail = computed(() => {
      if (!emailLocalPart.value) return ''
      return `${emailLocalPart.value}@${CORPORATE_DOMAIN}`
    })

    const isEmailValid = computed(() => {
      if (!emailLocalPart.value) return false
      // Разрешаем только латиницу, цифры, точку, дефис и нижнее подчеркивание
      const localPartRegex = /^[a-zA-Z0-9._-]+$/
      if (!localPartRegex.test(emailLocalPart.value)) return false
      if (emailLocalPart.value.length < 1) return false
      return true
    })

    const formattedTime = computed(() => {
      const mins = Math.floor(timer.value / 60)
      const secs = timer.value % 60
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    })

    // ===== Методы =====

    /**
     * Валидация локальной части email
     */
    const validateEmailLocalPart = () => {
      if (!emailLocalPart.value) {
        emailError.value = 'Введите логин'
        return false
      }
      
      const localPartRegex = /^[a-zA-Z0-9._-]+$/
      if (!localPartRegex.test(emailLocalPart.value)) {
        emailError.value = 'Только латиница, цифры, . _ -'
        return false
      }
      
      if (emailLocalPart.value.length < 1) {
        emailError.value = 'Минимум 1 символ'
        return false
      }
      
      emailError.value = ''
      return true
    }

    /**
     * Валидация кода (только цифры)
     */
    const validateCode = () => {
      code.value = code.value.replace(/\D/g, '')
      if (code.value.length > 0 && !/^\d+$/.test(code.value)) {
        codeError.value = 'Только цифры'
        return false
      }
      codeError.value = ''
      return true
    }

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
      if (!validateEmailLocalPart()) return
      if (!fullEmail.value) {
        emailError.value = 'Введите логин'
        return
      }
      if (isLoading.value) return

      isLoading.value = true
      errorMessage.value = ''

      try {
        await emailService.sendCode(fullEmail.value)
        codeSent.value = true
        startTimer(300)
        
        localStorage.setItem('u40ta_email_login', fullEmail.value)
        
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
        const data = await emailService.verifyCode(fullEmail.value, code.value)
        
        localStorage.setItem('auth_token', data.access_token)
        localStorage.removeItem('u40ta_email_login')
        
        emit('success')
        router.push('/')
      } catch (error) {
        codeError.value = error.message || 'Неверный код'
        code.value = ''
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
      emailLocalPart.value = ''
      code.value = ''
      codeSent.value = false
      timer.value = 0
      emailError.value = ''
      codeError.value = ''
      errorMessage.value = ''
      localStorage.removeItem('u40ta_email_login')
      emit('close')
    }

    /**
     * Восстановление состояния после F5
     */
    const restoreState = async () => {
      const savedEmail = localStorage.getItem('u40ta_email_login')
      if (!savedEmail || !props.isOpen) return

      const [local] = savedEmail.split('@')
      if (local) {
        emailLocalPart.value = local
      }

      try {
        const status = await emailService.checkCodeStatus(savedEmail)
        if (status.hasActiveCode) {
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
        const savedEmail = localStorage.getItem('u40ta_email_login')
        if (savedEmail) {
          restoreState()
        }
        setTimeout(() => {
          const emailInput = document.getElementById('email-input')
          if (emailInput) emailInput.focus()
        }, 200)
      }
    })

    onUnmounted(() => {
      clearInterval(timerInterval)
      timerInterval = null
    })

    return {
      emailLocalPart,
      code,
      isLoading,
      isVerifying,
      codeSent,
      timer,
      emailError,
      codeError,
      errorMessage,
      fullEmail,
      isEmailValid,
      formattedTime,
      validateEmailLocalPart,
      validateCode,
      handleSendCode,
      handleVerifyCode,
      handleResendCode,
      handleClose
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