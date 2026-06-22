import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home/Home.vue'
import DevLogin from '../views/Login/DevLogin.vue'
import Login from '../views/Login/Login.vue'

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
    path: '/scan/:qrCode',
    name: 'DeepLink',
    component: () => import('@/views/Guest/DeepLink.vue')
    // без meta.requiresAuth — гость может зайти
  },
  {
    path: '/statement/:receivedAt',
    name: 'Statement',
    component: () => import('@/views/Statement/StatementPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory/:id',
    name: 'Inventory',
    component: () => import('@/views/Inventory/InventoryPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/inventory-book/:id',
    name: 'InventoryBook',
    component: () => import('@/views/Inventory/InventoryPage.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/mol',
    name: 'MOL',
    component: () => import('@/views/MOL/MOL.vue'),
    meta: { requiresAuth: true }
  }  
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

/**
 * Глобальный навигационный хук
 * Проверяет авторизацию для маршрутов с requiresAuth
 */
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('auth_token')
  const isDevelopment = import.meta.env.DEV

  // Только для маршрутов, требующих авторизации
  if (to.meta.requiresAuth && !isAuthenticated) {
    if (isDevelopment) {
      next('/dev-login')
    } else {
      const redirectPath = to.fullPath
      next(`/login?redirect=${encodeURIComponent(redirectPath)}`)
    }
    return
  }

  next()
})

export default router