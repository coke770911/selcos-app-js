import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { LoginRequest, LoginResponse, MeResponse } from '@selcos/shared';
import { http } from '@/api/http';

// sessionStorage 只在同一個分頁有效：開新分頁需重新登入，並會讓舊分頁的登入失效
const STORAGE_KEY = 'selcos.auth';

interface Saved {
  token: string;
  me: MeResponse;
}

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(value: Saved | null) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無痕模式等無法存取時，只在記憶體中保留
  }
}

export const useAuthStore = defineStore('auth', () => {
  const saved = load();
  const token = ref<string | null>(saved?.token ?? null);
  const me = ref<MeResponse | null>(saved?.me ?? null);
  /** 被登出時要在登入頁顯示的訊息 */
  const notice = ref('');

  const expiresAt = computed(() => (me.value ? new Date(me.value.expiresAt).getTime() : 0));
  const isLoggedIn = computed(() => !!token.value && expiresAt.value > Date.now());

  function clear(message = '') {
    token.value = null;
    me.value = null;
    notice.value = message;
    save(null);
  }

  async function login(req: LoginRequest) {
    const { data } = await http.post<LoginResponse>('/auth/login', req);
    const { token: t, ...rest } = data;
    token.value = t;
    me.value = rest;
    notice.value = '';
    save({ token: t, me: rest });
  }

  async function logout(message = '您已成功登出選課系統！') {
    try {
      if (token.value) await http.post('/auth/logout');
    } finally {
      clear(message);
    }
  }

  return { token, me, notice, expiresAt, isLoggedIn, login, logout, clear };
});
