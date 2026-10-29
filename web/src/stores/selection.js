import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { selectionApi } from '@/api/selection';

/** @import { CourseKey, EnrollRequest, SelectionState } from '@selcos/shared' */

/**
 * 預覽中的課程（清單或課表 hover、手機點選時）
 * @typedef {CourseKey & { credit: number; periods: string[] }} PreviewCourse
 */

/** @typedef {'add' | 'drop'} EnrollAction */

/**
 * 選課畫面共用狀態（取代舊系統直接改 DOM 的做法）：
 * 目前課表、學分，以及 hover 時標示節次、顯示學分增減。
 */
export const useSelectionStore = defineStore('selection', () => {
  const state = ref(/** @type {SelectionState | null} */ (null));
  const busy = ref(false);
  const preview = ref(/** @type {{ course: PreviewCourse; action: EnrollAction } | null} */ (null));

  const previewPeriods = computed(() => new Set(preview.value?.course.periods ?? []));

  /**
   * @param {PreviewCourse | null} course
   * @param {EnrollAction} [action]
   */
  function setPreview(course, action = 'add') {
    preview.value = course ? { course, action } : null;
  }

  async function load() {
    state.value = await selectionApi.state();
  }

  /**
   * 加選、退選成功後以伺服器回傳的最新課表為準
   * @param {EnrollAction} action
   * @param {EnrollRequest} key
   */
  async function run(action, key) {
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
    /** @param {EnrollRequest} key */
    add: (key) => run('add', key),
    /** @param {EnrollRequest} key */
    drop: (key) => run('drop', key),
  };
});
