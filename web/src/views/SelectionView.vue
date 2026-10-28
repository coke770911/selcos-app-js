<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NEmpty } from 'naive-ui';
import TopBar from '@/components/TopBar.vue';
import NoticeDialog from '@/components/NoticeDialog.vue';
import { useSessionWatch } from '@/composables/useSessionWatch';

// 同一帳號在其他地方登入時，10 秒內把這個視窗登出
useSessionWatch();

// 進入選課畫面時的重要提醒（舊系統 selcos_main.php）
const showReminder = ref(true);
</script>

<template>
  <div class="min-h-screen bg-[#f6f5ff] dark:bg-transparent">
    <TopBar />
    <main class="mx-auto max-w-7xl px-4 py-5 grid gap-5 md:grid-cols-[300px_1fr]">
      <NCard title="🔍 課程查詢" :bordered="false" class="shadow-md">
        <NEmpty description="課程查詢（階段 3 實作）" />
      </NCard>
      <NCard title="🗓️ 我的課表" :bordered="false" class="shadow-md">
        <NEmpty description="課表與加退選（階段 4–5 實作）" />
      </NCard>
    </main>

    <NoticeDialog v-model:show="showReminder" title="重要提醒" positive-text="關閉">
      <ol>
        <li>請務必檢視歷年成績單，應加選未修之科目及學分。</li>
        <li class="danger">重覆修同樣課程將不予以採計學分！</li>
        <li>課程重修時請注意！如選修非本系課程請先確認是否可以修課再行選課！</li>
        <li>轉學、轉系同學，補修時請注意冊別與修課順序。</li>
        <li>
          轉學、轉系同學，補修功能僅方便提供加選，<span class="danger">請勿重複加選</span
          >以免畢業學分不足。
        </li>
        <li>轉學、轉系同學，若已抵免課程，請勿再補修已抵免課程。</li>
        <li>畢業詳細所需學分，請參考課程總表。</li>
      </ol>
    </NoticeDialog>
  </div>
</template>
