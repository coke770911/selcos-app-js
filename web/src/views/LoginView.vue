<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NAlert, NButton, NCard, NForm, NFormItem, NInput, NTag, useMessage } from 'naive-ui';
import type { CaptchaResponse, ScheduleItem } from '@selcos/shared';
import { errorMessage, http } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { useAppInfoStore } from '@/stores/appInfo';
import ThemeToggle from '@/components/ThemeToggle.vue';

const router = useRouter();
const message = useMessage();
const auth = useAuthStore();
const appInfo = useAppInfoStore();

const form = ref({ account: '', password: '', captcha: '' });
const captcha = ref<CaptchaResponse | null>(null);
const captchaInput = ref<InstanceType<typeof NInput> | null>(null);
const submitting = ref(false);

const schedule = ref<ScheduleItem[] | null>(null);
const scheduleError = ref(false);
const online = ref<number | null>(null);
const now = ref(new Date());
const sessionMinutes = computed(() => Math.round((appInfo.info?.sessionTtlSeconds ?? 1800) / 60));

async function refreshCaptcha() {
  form.value.captcha = '';
  try {
    captcha.value = (await http.get<CaptchaResponse>('/auth/captcha')).data;
  } catch {
    captcha.value = null;
  }
}

async function submit() {
  const { account, password, captcha: code } = form.value;
  if (!account.trim() || !password) return message.warning('請輸入學號與密碼！');
  if (!code.trim()) return message.warning('請輸入驗證碼！');
  if (!captcha.value) return refreshCaptcha();

  submitting.value = true;
  try {
    await auth.login({ account, password, captcha: code, captchaId: captcha.value.captchaId });
    message.success('認證成功！');
    await router.replace({ name: 'selection' });
  } catch (err) {
    message.error(errorMessage(err));
    // 驗證碼用過即作廢，失敗後換一張（同舊系統：清空驗證碼並游標移回驗證碼）
    await refreshCaptcha();
    await nextTick();
    captchaInput.value?.focus();
  } finally {
    submitting.value = false;
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(async () => {
  timer = setInterval(() => (now.value = new Date()), 1000);
  void refreshCaptcha();
  http
    .get<ScheduleItem[]>('/public/schedule')
    .then((r) => (schedule.value = r.data))
    .catch(() => (scheduleError.value = true));
  http
    .get<{ count: number }>('/public/online')
    .then((r) => (online.value = r.data.count))
    .catch(() => undefined);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="login-bg min-h-screen px-4 py-6 md:py-12">
    <div class="mx-auto max-w-5xl">
      <header class="relative mb-6 text-white text-center md:text-left">
        <div class="flex justify-end md:absolute md:right-0 md:top-0 mb-2 md:mb-0">
          <ThemeToggle />
        </div>
        <div class="text-sm opacity-90 tracking-widest">亞東科技大學</div>
        <h1 class="m-0 text-3xl md:text-4xl font-extrabold">
          選課系統
          <span v-if="appInfo.info?.titleSuffix" class="text-xl align-middle">
            {{ appInfo.info.titleSuffix }}
          </span>
        </h1>
        <div class="mt-2 text-sm opacity-90 flex gap-4 justify-center md:justify-start">
          <span>目前時間：{{ now.toLocaleString('zh-TW', { hour12: false }) }}</span>
          <span v-if="online !== null">線上人數：{{ online }}</span>
          <span v-if="appInfo.info" class="opacity-75">v{{ appInfo.info.version }}</span>
        </div>
      </header>

      <div class="grid gap-5 md:grid-cols-[360px_1fr] items-start">
        <NCard class="shadow-xl" :bordered="false" size="large">
          <h2 class="m-0 mb-4 text-xl font-bold">登入選課 🎒</h2>
          <!-- 被登出的原因（在其他地方登入、逾時…）固定顯示，避免切回分頁時已看不到 -->
          <NAlert v-if="auth.notice" type="warning" closable class="mb-4" @close="auth.notice = ''">
            {{ auth.notice }}
          </NAlert>
          <NForm :show-label="true" label-placement="top" @submit.prevent="submit">
            <NFormItem label="學號">
              <NInput
                v-model:value="form.account"
                placeholder="請輸入學號"
                :input-props="{ autocomplete: 'username' }"
                size="large"
              />
            </NFormItem>
            <NFormItem label="密碼">
              <NInput
                v-model:value="form.password"
                type="password"
                show-password-on="click"
                placeholder="請輸入密碼"
                :input-props="{ autocomplete: 'current-password' }"
                size="large"
              />
            </NFormItem>
            <NFormItem label="驗證碼">
              <div class="flex gap-2 w-full items-center">
                <NInput
                  ref="captchaInput"
                  v-model:value="form.captcha"
                  placeholder="請輸入驗證碼"
                  :maxlength="4"
                  :input-props="{ inputmode: 'numeric', autocomplete: 'off' }"
                  size="large"
                />
                <button
                  type="button"
                  class="captcha-btn"
                  title="點一下換一組驗證碼"
                  @click="refreshCaptcha"
                >
                  <!-- eslint-disable-next-line vue/no-v-html -- SVG 由本系統 API 產生 -->
                  <span v-if="captcha" v-html="captcha.svg" />
                  <span v-else class="text-xs">重新載入</span>
                </button>
              </div>
            </NFormItem>
            <NButton
              type="primary"
              attr-type="submit"
              size="large"
              block
              round
              :loading="submitting"
            >
              登入
            </NButton>
          </NForm>
          <p class="mt-4 mb-0 text-xs opacity-60">
            使用學校 AD 帳號密碼登入；請勿同時開兩個視窗或分頁選課。
          </p>
        </NCard>

        <div class="grid gap-5">
          <NCard :bordered="false" class="shadow-xl" title="📅 開放登入時間及可選課學制年級">
            <p v-if="scheduleError" class="m-0 opacity-60">
              暫時無法取得開放時段，請至教務處公告查詢。
            </p>
            <p v-else-if="schedule === null" class="m-0 opacity-60">載入中…</p>
            <p v-else-if="schedule.length === 0" class="m-0">尚未開放</p>
            <ul v-else class="m-0 pl-0 list-none grid gap-3">
              <li v-for="item in schedule" :key="item.begin" class="schedule-item">
                <div class="font-semibold">{{ item.begin }} ～ {{ item.end }}</div>
                <div class="mt-1 flex flex-wrap gap-1">
                  <NTag v-for="g in item.groups" :key="g" size="small" round type="info">
                    {{ g }}
                  </NTag>
                </div>
              </li>
            </ul>
          </NCard>

          <NCard :bordered="false" class="shadow-xl" title="📌 選課須知">
            <ol class="m-0 pl-5 grid gap-1.5 leading-relaxed">
              <li>
                各年級選課詳細時間請至
                <a href="https://acea.aeust.edu.tw/" target="_blank" rel="noopener">教務處公告</a>
                查詢。
              </li>
              <li>
                選課說明手冊：
                <a
                  href="https://eservice.aeust.edu.tw/download/doc/亞東選課系統行動版操作手冊.pdf"
                  target="_blank"
                  rel="noopener"
                  >行動版</a
                >。
              </li>
              <li class="text-[var(--warn)]">
                預選階段，請確認 PORTAL 學期期末學習評量問卷已填寫完成，否則將無法進行預選。
                <a href="https://portal.aeust.edu.tw/" target="_blank" rel="noopener"
                  >前往 Portal</a
                >
              </li>
              <li>
                請確認需修習的課程學分，
                <a
                  href="https://portal.aeust.edu.tw/index.php?sid=CosQuery&mode=Query&QueryMode=P&pname=CosQuery"
                  target="_blank"
                  rel="noopener"
                  >課程總表請點我</a
                >。
              </li>
              <li class="text-[var(--warn)]">
                請勿同時用兩個視窗（或分頁）登入系統，否則造成個人選課資料不正確，後果請自行負責。
              </li>
              <li>
                每次選課時間為
                <strong class="text-[var(--warn)]">{{ sessionMinutes }}</strong>
                分鐘，時間到系統將自動登出。
              </li>
              <li class="text-[var(--warn)]">選完課程後務必登出再登入系統確認課程。</li>
              <li>最後選課結果以<strong>教務處的資料庫記錄為準</strong>。</li>
            </ol>
          </NCard>

          <NAlert type="info" :bordered="false">
            支援電腦與手機瀏覽器；若手機操作有問題，請改用電腦進行選課。
          </NAlert>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-bg {
  --warn: #e5484d;
  background:
    radial-gradient(circle at 15% 20%, rgba(255, 255, 255, 0.18) 0 120px, transparent 121px),
    radial-gradient(circle at 85% 10%, rgba(255, 200, 80, 0.35) 0 90px, transparent 91px),
    linear-gradient(135deg, #7c5cff 0%, #5b8cff 55%, #3bb2f6 100%);
}
.captcha-btn {
  flex: none;
  width: 110px;
  height: 40px;
  padding: 0;
  border: 1px dashed rgba(124, 92, 255, 0.5);
  border-radius: 10px;
  background: #f4f1ff;
  cursor: pointer;
  overflow: hidden;
  display: grid;
  place-items: center;
}
.captcha-btn :deep(svg) {
  display: block;
}
.schedule-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(124, 92, 255, 0.08);
}
</style>
