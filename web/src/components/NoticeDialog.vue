<script setup lang="ts">
import { NModal } from 'naive-ui';

/**
 * 共用提示對話框（取代 alert / confirm，不會阻擋瀏覽器）。
 * 內容寫在預設 slot；對話框屬於使用它的元件，離開畫面時會跟著關閉。
 */
withDefaults(
  defineProps<{
    title: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    positiveText?: string;
    /** 有值才顯示取消按鈕 */
    negativeText?: string;
  }>(),
  { type: 'info', positiveText: '確定', negativeText: undefined },
);

const show = defineModel<boolean>('show', { required: true });

const emit = defineEmits<{
  positive: [];
  negative: [];
}>();

function onPositive() {
  show.value = false;
  emit('positive');
}

function onNegative() {
  show.value = false;
  emit('negative');
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="dialog"
    :type="type"
    :title="title"
    :positive-text="positiveText"
    :negative-text="negativeText"
    :closable="false"
    :mask-closable="false"
    :close-on-esc="false"
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
