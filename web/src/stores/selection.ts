import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { CourseKey, EnrollRequest, SelectionState } from '@selcos/shared';
import { selectionApi } from '@/api/selection';

/** 預覽中的課程（清單或課表 hover、手機點選時） */
export interface PreviewCourse extends CourseKey {
  credit: number;
  periods: string[];
}

/**
 * 選課畫面共用狀態（取代舊系統直接改 DOM 的做法）：
 * 目前課表、學分，以及 hover 時標示節次、顯示學分增減。
 */
export const useSelectionStore = defineStore('selection', () => {
  const state = ref<SelectionState | null>(null);
  const busy = ref(false);
  const preview = ref<{ course: PreviewCourse; action: 'add' | 'drop' } | null>(null);

  const previewPeriods = computed(() => new Set(preview.value?.course.periods ?? []));

  function setPreview(course: PreviewCourse | null, action: 'add' | 'drop' = 'add') {
    preview.value = course ? { course, action } : null;
  }

  async function load() {
    state.value = await selectionApi.state();
  }

  /** 加選、退選成功後以伺服器回傳的最新課表為準 */
  async function run(action: 'add' | 'drop', key: EnrollRequest) {
    busy.value = true;
    try {
      state.value = await (action === 'add' ? selectionApi.add(key) : selectionApi.drop(key));
      preview.value = null;
    } finally {
      busy.value = false;
    }
  }

  return {
    state,
    busy,
    preview,
    previewPeriods,
    setPreview,
    load,
    add: (key: EnrollRequest) => run('add', key),
    drop: (key: EnrollRequest) => run('drop', key),
  };
});
