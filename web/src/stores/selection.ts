import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CourseListItem } from '@selcos/shared';

/**
 * 選課畫面共用狀態（取代舊系統直接改 DOM 的做法）：
 * 滑鼠移到課程上時標示節次、頂端列顯示學分增減。
 */
export const useSelectionStore = defineStore('selection', () => {
  /** 目前預覽的課程（清單 hover 或手機點選時） */
  const preview = ref<{ course: CourseListItem; action: 'add' | 'drop' } | null>(null);

  function setPreview(course: CourseListItem | null, action: 'add' | 'drop' = 'add') {
    preview.value = course ? { course, action } : null;
  }

  return { preview, setPreview };
});
