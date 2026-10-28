<script setup lang="ts">
import { NModal } from 'naive-ui';

/**
 * 共用提示對話框（取代 alert / confirm，不會阻擋瀏覽器）。
 * 內容寫在預設 slot；對話框屬於使用它的元件，離開畫面時會跟著關閉。
 */
const props = withDefaults(
  defineProps<{
    title: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    /** null 時不顯示主要按鈕 */
    positiveText?: string | null;
    /** 有值才顯示取消按鈕 */
    negativeText?: string;
    /** 可點遮罩或按 Esc 關閉（一般資訊用；強制提醒維持 false） */
    dismissible?: boolean;
  }>(),
  { type: 'info', positiveText: '確定', negativeText: undefined, dismissible: false },
);

const show = defineModel<boolean>('show', { required: true });

const emit = defineEmits<{
  positive: [];
  negative: [];
}>();

// 先通知再關閉：使用端常以「有無待確認資料」決定是否顯示，先關閉會把資料清掉
function onPositive() {
  emit('positive');
  show.value = false;
}

function onNegative() {
  emit('negative');
  show.value = false;
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="dialog"
    :type="type"
    :title="title"
    :positive-text="props.positiveText ?? undefined"
    :negative-text="negativeText"
    :closable="dismissible"
    :mask-closable="dismissible"
    :close-on-esc="dismissible"
    style="max-width: calc(100vw - 32px)"
    @positive-click="onPositive"
    @negative-click="onNegative"
  >
    <div class="notice-body">
      <slot />
    </div>
  </NModal>
</template>

<style scoped>
.notice-body :deep(ol) {
  margin: 0;
  padding-left: 1.25rem;
  line-height: 1.7;
}
.notice-body :deep(.danger) {
  color: #e5484d;
}
</style>
