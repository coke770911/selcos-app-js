import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'virtual:uno.css';
import App from './App.vue';
import { router } from './router';
import { setupHttp } from './api/http';
import { useAuthStore } from './stores/auth';

const app = createApp(App).use(createPinia()).use(router);

const auth = useAuthStore();
setupHttp({
  getToken: () => auth.token,
  onUnauthorized: (message) => {
    auth.clear(message);
    void router.replace({ name: 'login' });
  },
});

app.mount('#app');
