import { defineStore } from 'pinia';
import { ref } from 'vue';

import { http } from '@/api/http';

/** @import { AppInfo } from '@selcos/shared' */

/** 系統資訊由 API 提供（設定統一在 server/.env），並同步瀏覽器標題 */
export const useAppInfoStore = defineStore('appInfo', () => {
  const info = ref(/** @type {AppInfo | null} */ (null));

  async function load() {
    /** @type {AppInfo} */
    const data = (await http.get('/public/app-info')).data;
    info.value = data;
    document.title = `${data.title}${data.titleSuffix}`;
  }

  return { info, load };
});
