import { onMounted, onUnmounted } from 'vue';
import { http } from '@/api/http';

/**
 * 定期確認登入是否仍有效，被其他地方的登入取代時盡快回到登入頁。
 * 401 由 http 攔截器統一處理（清除登入、導回登入頁並顯示原因）。
 * 分頁在背景時不確認以減少伺服器負擔，切回分頁或視窗取得焦點時立即確認。
 */
export function useSessionWatch(intervalMs = 10_000) {
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer;
  let checking = false;

  async function check() {
    if (checking || document.visibilityState === 'hidden') return;
    checking = true;
    try {
      await http.get('/auth/check');
    } catch {
      // 401 已由攔截器處理；網路暫時中斷就等下一次
    } finally {
      checking = false;
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') void check();
  };

  onMounted(() => {
    timer = setInterval(check, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
  });

  onUnmounted(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
  });
}
