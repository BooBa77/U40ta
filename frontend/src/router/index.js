import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home/Home.vue'
import DevLogin from '../views/DevLogin.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/dev-login', 
    name: 'DevLogin',
    component: DevLogin
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/scan/:qrCode', // переход на сайт по ссылке с QR-кода
    name: 'ScanRedirect',
    component: { template: '<div></div>' }, // Пустой компонент
    meta: { requiresAuth: true },
    beforeEnter: (to, from, next) => {
      // Собираем полный URL
      const fullUrl = window.location.origin + to.fullPath
      // Редирект на Home с qr-параметром
      next({
        path: '/',
        query: { 
          qr: fullUrl,
          from: 'scan'
        }
      })
    }
  },
  {
    path: '/statement/:id',
    name: 'Statement',
    component: () => import('@/views/Statement/StatementPage.vue'),
    meta: { requiresAuth: true }
  },
/*
  {
    path: '/inventory/:id',
    name: 'Inventory',
    component: () => import('@/views/Inventory/InventoryPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/object/edit/:id',
    name: 'ObjectEdit',
    component: () => import('@/views/ObjectForm/ObjectForm.vue'),
    meta: { requiresAuth: true },
    props: (route) => ({
      mode: 'edit',
      id: route.params.id
    })
  }
*/
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Навигационный хук для проверки авторизации
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('auth_token')
  const isDevelopment = import.meta.env.DEV;
  
  // Если это путь /scan/... (вход на сайт по ссылке с QR-кода)
  if (to.path.startsWith('/scan/')) {
    // Собираем полный URL
    const fullUrl = window.location.origin + to.fullPath
    
    // Если авторизован — сразу на Home с qr-параметром
    if (isAuthenticated) {
      next({
        path: '/',
        query: { 
          qr: fullUrl,
          from: 'scan'
        }
      })
      return
    }
    // Если не авторизован — ТОЛЬКО НА ПРОДЕ сохраняем полный путь
    // В разработчике — обычный редирект без redirect
    if (isDevelopment) {
      next('/dev-login')  // без redirect параметра
    } else {
      next(`/login?redirect=${encodeURIComponent(fullUrl)}`)
    }
    return
  }
  
  // Остальная логика для других маршрутов
  if (to.meta.requiresAuth && !isAuthenticated) {
    // ТОЛЬКО НА ПРОДЕ сохраняем redirect
    if (isDevelopment) {
      next('/dev-login')
    } else {
      const redirectPath = to.fullPath
      next(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    }
  } else {
    next()
  }
})

export default router