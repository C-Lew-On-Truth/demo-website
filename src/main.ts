import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import EditorView from './views/EditorView.vue'
import PreviewView from './views/PreviewView.vue'
import './style.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: EditorView },
    { path: '/preview/:id', component: PreviewView },
  ],
})

const app = createApp(App)
app.use(router)
app.mount('#app')
