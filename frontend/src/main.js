import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import '../public/css/global.css'
import '../public/css/tailwind.css'

createApp(App).use(router).mount('#app')