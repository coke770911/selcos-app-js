import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

/** @typedef {'auto' | 'light' | 'dark'} ThemeMode */

const STORAGE_KEY = 'selcos.theme';

/** @returns {ThemeMode} */
function loadMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * 亮色／暗色主題：auto 跟隨系統，light、dark 為使用者指定。
 * 選擇記在 localStorage（每台電腦、每個瀏覽器各自記住）。
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref(loadMode());

  const media =
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const systemDark = ref(media?.matches ?? false);
  media?.addEventListener('change', (e) => (systemDark.value = e.matches));

  const isDark = computed(() => (mode.value === 'auto' ? systemDark.value : mode.value === 'dark'));

  watch(mode, (v) => {
    try {
      if (v === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // 無痕模式等無法存取時，只在這次瀏覽有效
    }
  });

  // UnoCSS 的 dark: 樣式與瀏覽器原生元件（捲軸等）跟著切換
  watch(
    isDark,
    (dark) => {
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    },
    { immediate: true },
  );

  /** 依序切換：跟隨系統 → 亮色 → 暗色 */
  function cycle() {
    mode.value = mode.value === 'auto' ? 'light' : mode.value === 'light' ? 'dark' : 'auto';
  }

  return { mode, isDark, cycle };
});
