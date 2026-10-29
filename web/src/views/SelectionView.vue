<script setup>
import { computed, onMounted, ref } from 'vue';
import { NCard, NSpin, useMessage } from 'naive-ui';
import TopBar from '@/components/TopBar.vue';
import NoticeDialog from '@/components/NoticeDialog.vue';
import CourseFilter from '@/components/CourseFilter.vue';
import CourseList from '@/components/CourseList.vue';
import CourseInfoDialog from '@/components/CourseInfoDialog.vue';
import CourseTimetable from '@/components/CourseTimetable.vue';
import { coursesApi } from '@/api/courses';
import { errorMessage } from '@/api/http';
import { useSessionWatch } from '@/composables/useSessionWatch';
import { useSelectionStore } from '@/stores/selection';

/**
 * @import { CourseInfo, CourseKey, CourseListItem, SelectedCourse } from '@selcos/shared'
 * @import { CourseQuery } from '@/api/courses'
 */

const message = useMessage();
const selection = useSelectionStore();

// 同一帳號在其他地方登入時，10 秒內把這個視窗登出
useSessionWatch();

// 進入選課畫面時的重要提醒（舊系統 selcos_main.php）
const showReminder = ref(true);

onMounted(() => selection.load().catch((err) => message.error(errorMessage(err))));

const courses = ref(/** @type {CourseListItem[]} */ ([]));
const loading = ref(false);

/** @param {CourseQuery} query */
async function search(query) {
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

// ---- 課程資訊（清單開啟為加選、課表開啟為退選） ----
const infoCourse = ref(/** @type {CourseKey | null} */ (null));
const infoAction = ref(/** @type {'add' | 'drop'} */ ('add'));
const showInfo = ref(false);

/**
 * @param {CourseKey} course
 * @param {'add' | 'drop'} action
 */
function openInfo(course, action) {
  infoCourse.value = course;
  infoAction.value = action;
  showInfo.value = true;
}

/** @param {boolean} visible */
function onInfoClosed(visible) {
  if (!visible) selection.setPreview(null);
}

// ---- 加退選結果（同舊系統以彈窗顯示成功或失敗原因） ----
// 內容與顯示分開：關閉時只隱藏，淡出動畫期間內容不會變成空白的「無法完成」
const result = ref({ ok: true, text: '' });
const showResult = ref(false);

/**
 * @param {boolean} ok
 * @param {string} text
 */
function showOutcome(ok, text) {
  result.value = { ok, text };
  showResult.value = true;
}

/** @param {CourseKey} c */
const key = (c) => ({ cosId: c.cosId, cosClass: c.cosClass, cosTerm: c.cosTerm });

/** @param {CourseInfo} info */
async function add(info) {
  try {
    await selection.add(key(info));
    showOutcome(true, '加選成功！');
  } catch (err) {
    showOutcome(false, errorMessage(err));
  }
}

/** @param {CourseInfo} info */
async function dropNow(info) {
  try {
    await selection.drop(key(info));
    showOutcome(true, '退選完成！');
  } catch (err) {
    showOutcome(false, errorMessage(err));
  }
}

// 舊系統：退選後會低於學分下限時先確認
const pendingDrop = ref(/** @type {CourseInfo | null} */ (null));
const showDropConfirm = computed({
  get: () => pendingDrop.value !== null,
  set: (v) => {
    if (!v) pendingDrop.value = null;
  },
});

/** @param {CourseInfo} info */
function drop(info) {
  const credit = selection.state?.credit;
  if (credit && credit.min !== 0 && credit.min > credit.now - info.credit) {
    pendingDrop.value = info;
  } else {
    void dropNow(info);
  }
}

function confirmDrop() {
  const info = pendingDrop.value;
  pendingDrop.value = null;
  if (info) void dropNow(info);
}

/** @param {SelectedCourse} c */
function openFromTimetable(c) {
  openInfo(c, 'drop');
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
      <NCard title="🗓️ 我的課表" :bordered="false" class="shadow-md" size="small">
        <NSpin :show="selection.busy">
          <CourseTimetable :courses="selection.state?.courses ?? []" @select="openFromTimetable" />
        </NSpin>
      </NCard>
    </main>

    <CourseInfoDialog
      v-model:show="showInfo"
      :course="infoCourse"
      :action="infoAction"
      @update:show="onInfoClosed"
      @add="add"
      @drop="drop"
    />

    <NoticeDialog
      v-model:show="showDropConfirm"
      type="warning"
      title="退選確認"
      positive-text="確定"
      negative-text="取消"
      @positive="confirmDrop"
    >
      退選課程學分將低於下限！如要退選請按確定。
    </NoticeDialog>

    <NoticeDialog
      v-model:show="showResult"
      :type="result.ok ? 'success' : 'error'"
      :title="result.ok ? '完成' : '無法完成'"
      dismissible
    >
      {{ result.text }}
    </NoticeDialog>

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
