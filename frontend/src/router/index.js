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
  path: '/dbtools',
  name: 'DBTools',
  component: () => import('@/views/DBTools.vue'),
  meta: { requiresAuth: true }
  },
  {
    path: '/object/add_01', // Страница создания нового объекта
    name: 'ObjectAdd',
    component: () => import('@/views/ObjectForm/ObjectForm.vue'),
    meta: { requiresAuth: true },
    props: (route) => ({
      mode: 'add',
      initialData: route.params.initialData // Бухгалтерские данные из эксель ОСВ, или заглушки при ручном вводе
    })
  },
  {
  path: '/object/add',
  name: 'ObjectAdd',
  component: () => import('@/views/ObjectForm/ObjectForm.vue'),
  meta: { requiresAuth: true },
  props: (route) => ({
    mode: 'add',
    initialData: route.query.initialData ? JSON.parse(route.query.initialData) : null
  })
}
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Навигационный хук для проверки авторизации
router.beforeEach((to, from, next) => {
  const isAuthenticated = localStorage.getItem('auth_token')
  const isDevelopment = import.meta.env.DEV;
  
/*
  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/dev-login')  // <- редирект на dev-login вместо login
  } else {
    next()
  }
*/
  if (to.meta.requiresAuth && !isAuthenticated) {
    // В разработке - на dev-login, на проде - на обычный login
    if (isDevelopment) {
      next('/dev-login');
    } else {
      next('/login');
    }
  } else {
    next();
  }

})

export default router