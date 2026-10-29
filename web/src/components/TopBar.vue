<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import { useAuthStore } from '@/stores/auth';
import { useSelectionStore } from '@/stores/selection';
import { useAppInfoStore } from '@/stores/appInfo';
import NoticeDialog from './NoticeDialog.vue';
import ThemeToggle from './ThemeToggle.vue';

const auth = useAuthStore();
const selection = useSelectionStore();
const appInfo = useAppInfoStore();
const router = useRouter();

/** 預覽課程時顯示學分增減（舊系統 #credit_num） */
const creditDelta = computed(() => {
  const p = selection.preview;
  if (!p) return null;
  return p.action === 'add' ? `+${p.course.credit}` : `-${p.course.credit}`;
});

const showLogoutConfirm = ref(false);
const showTimeUp = ref(false);

const remaining = ref(0);
const countdown = computed(() => {
  const s = Math.max(0, remaining.value);
  return `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, '0')} 秒`;
});
const urgent = computed(() => remaining.value <= 60);

/** @param {string} [message] */
async function doLogout(message) {
  await auth.logout(message).catch(() => undefined);
  await router.replace({ name: 'login' });
}

/** @type {ReturnType<typeof setInterval> | undefined} */
let timer;
function tick() {
  remaining.value = Math.round((auth.expiresAt - Date.now()) / 1000);
  if (remaining.value <= 0) {
    clearInterval(timer);
    showLogoutConfirm.value = false;
    showTimeUp.value = true;
  }
}
onMounted(() => {
  tick();
  timer = setInterval(tick, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <header class="topbar">
    <div class="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex items-center gap-2 mr-auto">
        <span class="text-lg font-extrabold">選課系統</span>
        <span v-if="appInfo.info" class="text-xs opacity-70">v{{ appInfo.info.version }}</span>
        <NTag v-if="auth.me" round type="warning" :bordered="false">
          {{ auth.me.env.modeName }} · {{ auth.me.env.smtr }}
        </NTag>
        <NTag v-if="auth.me?.user.role === 'admin'" round type="error" :bordered="false">
          管理員代登 {{ auth.me.user.adminId }}
        </NTag>
      </div>

      <div v-if="auth.me" class="text-sm">
        {{ auth.me.user.deptName }} {{ auth.me.user.degree }} 年級 ·
        <strong>{{ auth.me.user.name }}</strong>
        <span class="opacity-75">（{{ auth.me.user.stdNo }}）</span>
      </div>

      <div class="text-sm" :class="{ 'text-red-200 font-bold': urgent }">
        ⏱ 選課時間：{{ countdown }}
      </div>

      <!-- 目前學分與上下限；預覽時顯示學分增減（舊系統 #now_credit、#credit_num） -->
      <div class="text-sm">
        📚 目前學分 {{ selection.state?.credit.now ?? '–' }}
        <strong
          v-if="creditDelta"
          class="delta"
          :class="selection.preview?.action === 'add' ? 'plus' : 'minus'"
        >
          {{ creditDelta }}
        </strong>
        [ 上 {{ auth.me?.credit?.max ?? '–' }} / 下 {{ auth.me?.credit?.min ?? '–' }} ]
      </div>

      <ThemeToggle />
      <NButton size="small" round type="error" @click="showLogoutConfirm = true">登出</NButton>
    </div>

    <NoticeDialog
      v-model:show="showLogoutConfirm"
      type="warning"
      title="登出提醒"
      positive-text="登出"
      negative-text="取消"
      @positive="doLogout()"
    >
      <ol>
        <li class="danger">重覆修同樣課程將不予以採計學分！</li>
        <li class="danger">登出前請確認是否選滿下限學分數。</li>
        <li>畢業詳細所需學分，請參考課程總表。</li>
      </ol>
    </NoticeDialog>

    <NoticeDialog
      v-model:show="showTimeUp"
      type="error"
      title="選課時間已到"
      @positive="doLogout('選課時間已到，請重新登入。')"
    >
      系統將強制登出程式。
    </NoticeDialog>
  </header>
</template>

<style scoped>
.topbar {
  color: #fff;
  background: linear-gradient(90deg, #7c5cff, #5b8cff);
  box-shadow: 0 4px 16px rgba(91, 140, 255, 0.35);
  position: sticky;
  top: 0;
  z-index: 10;
}
.delta {
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}
.delta.plus {
  color: #16a34a;
}
.delta.minus {
  color: #e5193b;
}
</style>
