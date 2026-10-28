import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppInfo } from '@selcos/shared';
import { http } from '@/api/http';

/** 系統資訊由 API 提供（設定統一在 server/.env），並同步瀏覽器標題 */
export const useAppInfoStore = defineStore('appInfo', () => {
  const info = ref<AppInfo | null>(null);

  async function load() {
    info.value = (await http.get<AppInfo>('/public/app-info')).data;
    document.title = `${info.value.title}${info.value.titleSuffix}`;
  }

  return { info, load };
});
