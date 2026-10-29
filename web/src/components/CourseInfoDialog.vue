<script setup>
import { computed, ref, watch } from 'vue';
import { NSpin, NTag } from 'naive-ui';
import { coursesApi } from '@/api/courses';
import { errorMessage } from '@/api/http';
import NoticeDialog from './NoticeDialog.vue';

/**
 * @import { PropType } from 'vue'
 * @import { CourseInfo, CourseKey } from '@selcos/shared'
 */

/** 課程資訊（舊系統 selcos_cos_info.php）：從清單開啟為加選、從課表開啟為退選 */
const props = defineProps({
  course: { type: /** @type {PropType<CourseKey | null>} */ ([Object, null]), required: true },
  action: { type: /** @type {PropType<'add' | 'drop'>} */ (String), required: true },
});
const show = defineModel('show', { type: Boolean, required: true });
const emit = defineEmits({
  add: (/** @type {CourseInfo} */ _info) => true,
  drop: (/** @type {CourseInfo} */ _info) => true,
});

const info = ref(/** @type {CourseInfo | null} */ (null));
const loading = ref(false);
const error = ref('');

watch(
  () => /** @type {const} */ ([show.value, props.course]),
  async ([visible, course]) => {
    if (!visible || !course) return;
    info.value = null;
    error.value = '';
    loading.value = true;
    try {
      info.value = await coursesApi.info(course);
    } catch (err) {
      error.value = errorMessage(err, '查無課程');
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const actionText = computed(() => {
  if (!info.value) return null;
  if (props.action === 'add') return info.value.actions.add ? '加選' : null;
  return info.value.actions.drop ? '退選' : null;
});

/** 上課時間沿用舊系統的節次代碼（星期 1–7 + 節次 01–15），例如 103 = 星期一第 3 節 */
const periodText = computed(() => (info.value?.periods ?? []).join(', '));

function onPositive() {
  if (!info.value) return;
  if (props.action === 'add') emit('add', info.value);
  else emit('drop', info.value);
}
</script>

<template>
  <NoticeDialog
    v-model:show="show"
    title="課程資訊"
    :positive-text="actionText"
    negative-text="取消"
    dismissible
    @positive="onPositive"
  >
    <NSpin :show="loading">
      <p v-if="error" class="m-0">{{ error }}</p>
      <dl v-else-if="info" class="info">
        <dt>課程名稱</dt>
        <dd>
          <strong>{{ info.name }}</strong>
        </dd>
        <dt>英文名稱</dt>
        <dd class="break-words">{{ info.englishName }}</dd>
        <dt>授課教師</dt>
        <dd>{{ info.teacher }}</dd>
        <dt>課程代號</dt>
        <dd>{{ info.cosId }}</dd>
        <dt>課程類別</dt>
        <dd>{{ info.typeName }}</dd>
        <dt>課程狀態</dt>
        <dd>
          <NTag size="small" round :type="info.canAdd ? 'success' : 'default'">
            {{ info.canAdd ? '可加選' : '不可加選' }}
          </NTag>
          <NTag size="small" round :type="info.canDrop ? 'success' : 'default'" class="ml-1">
            {{ info.canDrop ? '可退選' : '不可退選' }}
          </NTag>
        </dd>
        <dt>課程條件</dt>
        <dd>{{ info.condition }}</dd>
        <dt>開課系所</dt>
        <dd>{{ info.deptName }}</dd>
        <dt>開課年班</dt>
        <dd>{{ info.year }}{{ info.cosClass }}</dd>
        <dt>課程冊別</dt>
        <dd>{{ info.cosTerm }}</dd>
        <dt>課程學分</dt>
        <dd>{{ info.credit }}</dd>
        <dt>上課時間</dt>
        <dd>{{ periodText }}</dd>

        <hr />
        <template v-for="a in info.attributes" :key="a.label">
          <dt>{{ a.label }}</dt>
          <dd>{{ a.value }}</dd>
        </template>

        <hr />
        <dt>人數下限</dt>
        <dd>{{ info.minStudents }}</dd>
        <dt>人數上限</dt>
        <dd>{{ info.maxStudents }}</dd>
        <dt>目前人數</dt>
        <dd>{{ info.currentStudents }}</dd>

        <hr />
        <dt>課程備註</dt>
        <dd class="break-words">{{ info.memo }}</dd>
      </dl>
    </NSpin>
  </NoticeDialog>
</template>

<style scoped>
.info {
  display: grid;
  grid-template-columns: 5.5em 1fr;
  gap: 6px 12px;
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
}
.info dt {
  opacity: 0.65;
}
.info dd {
  margin: 0;
}
.info hr {
  grid-column: 1 / -1;
  width: 100%;
  border: 0;
  border-top: 1px dashed rgba(128, 128, 128, 0.35);
  margin: 4px 0;
}
</style>
