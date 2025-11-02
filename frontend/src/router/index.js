import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import DevLogin from '../views/DevLogin.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/dev-login',
    name: 'DevLogin', 
    component: DevLogin
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router