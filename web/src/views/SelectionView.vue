<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NEmpty, useMessage } from 'naive-ui';
import type { CourseKey, CourseListItem } from '@selcos/shared';
import TopBar from '@/components/TopBar.vue';
import NoticeDialog from '@/components/NoticeDialog.vue';
import CourseFilter from '@/components/CourseFilter.vue';
import CourseList from '@/components/CourseList.vue';
import CourseInfoDialog from '@/components/CourseInfoDialog.vue';
import { coursesApi, type CourseQuery } from '@/api/courses';
import { errorMessage } from '@/api/http';
import { useSessionWatch } from '@/composables/useSessionWatch';
import { useSelectionStore } from '@/stores/selection';

const message = useMessage();
const selection = useSelectionStore();

// 同一帳號在其他地方登入時，10 秒內把這個視窗登出
useSessionWatch();

// 進入選課畫面時的重要提醒（舊系統 selcos_main.php）
const showReminder = ref(true);

const courses = ref<CourseListItem[]>([]);
const loading = ref(false);

async function search(query: CourseQuery) {
  loading.value = true;
  try {
    courses.value = await coursesApi.list(query);
  } catch (err) {
    courses.value = [];
    message.error(errorMessage(err));
  } finally {
    loading.value = false;
  }
}

const infoCourse = ref<CourseKey | null>(null);
const infoAction = ref<'add' | 'drop'>('add');
const showInfo = ref(false);

function openInfo(course: CourseKey, action: 'add' | 'drop') {
  infoCourse.value = course;
  infoAction.value = action;
  showInfo.value = true;
}

function onInfoClosed(visible: boolean) {
  if (!visible) selection.setPreview(null);
}

// 加退選在階段 4 實作
function notReady() {
  message.info('加退選功能開發中（階段 4）');
}
</script>

<template>
  <div class="min-h-screen bg-[#f6f5ff] dark:bg-transparent">
    <TopBar />
    <main class="mx-auto max-w-7xl px-4 py-5 grid gap-5 md:grid-cols-[320px_1fr] items-start">
      <NCard title="🔍 課程查詢" :bordered="false" class="shadow-md" size="small">
        <CourseFilter @search="search" />
        <div class="mt-3">
          <CourseList :items="courses" :loading="loading" @select="openInfo($event, 'add')" />
        </div>
      </NCard>
      <NCard title="🗓️ 我的課表" :bordered="false" class="shadow-md">
        <NEmpty description="課表與加退選（階段 4–5 實作）" />
      </NCard>
    </main>

    <CourseInfoDialog
      v-model:show="showInfo"
      :course="infoCourse"
      :action="infoAction"
      @update:show="onInfoClosed"
      @add="notReady"
      @drop="notReady"
    />

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
