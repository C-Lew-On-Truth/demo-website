import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import EditorView from './views/EditorView.vue'
import PreviewView from './views/PreviewView.vue'
import './style.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: EditorView },
    { path: '/preview/:id', component: PreviewView },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
