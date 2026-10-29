<script setup>
import { computed } from 'vue';
import { PERIODS } from '@/courseKind';
import { useKindColor } from '@/composables/useKindColor';
import { useSelectionStore } from '@/stores/selection';

/**
 * @import { PropType } from 'vue'
 * @import { SelectedCourse } from '@selcos/shared'
 */

/**
 * 課表 7 天 × 15 節（舊系統 #cos_table）。
 * 預覽中的節次加底色；加選預覽與現有課程衝堂時標紅。點課程開啟課程資訊（退選）。
 */
const props = defineProps({
  courses: { type: /** @type {PropType<SelectedCourse[]>} */ (Array), required: true },
});
const emit = defineEmits({ select: (/** @type {SelectedCourse} */ _course) => true });

const selection = useSelectionStore();
const kindColor = useKindColor();
const DAYS = ['一', '二', '三', '四', '五', '六', '日'];

/** 節次代碼（例如 301）→ 該節的課 */
const byPeriod = computed(() => {
  /** @type {Map<string, SelectedCourse[]>} */
  const map = new Map();
  for (const c of props.courses) {
    for (const p of c.periods) map.set(p, [...(map.get(p) ?? []), c]);
  }
  return map;
});

/** @param {string} code */
function cellClass(code) {
  if (!selection.previewPeriods.has(code)) return '';
  const conflict = selection.preview?.action === 'add' && byPeriod.value.has(code);
  return conflict ? 'cell-conflict' : 'cell-preview';
}

/**
 * 舊系統：英語授課粉紅、跨域青色；其餘依類別顏色
 * @param {SelectedCourse} c
 */
function chipStyle(c) {
  if (c.crossDisciplinary) return { '--chip': '#14b8c4' };
  if (c.foreignLanguage === '英語') return { '--chip': '#f07a8c' };
  return { '--chip': kindColor(c.label.kind) };
}
</script>

<template>
  <div class="timetable-wrap">
    <div class="timetable" role="table" aria-label="我的課表">
      <div class="head corner" role="columnheader" />
      <div v-for="d in DAYS" :key="d" class="head" role="columnheader">{{ d }}</div>

      <template v-for="p in PERIODS" :key="p">
        <div class="period" role="rowheader">{{ p }}</div>
        <div
          v-for="(_, i) in DAYS"
          :key="`${i + 1}${p}`"
          class="cell"
          :class="cellClass(`${i + 1}${p}`)"
          role="cell"
        >
          <button
            v-for="c in byPeriod.get(`${i + 1}${p}`) ?? []"
            :key="`${c.cosId}-${c.cosClass}`"
            type="button"
            class="chip"
            :style="chipStyle(c)"
            :title="`${c.name}（${c.credit} 學分）`"
            @mouseenter="selection.setPreview(c, 'drop')"
            @mouseleave="selection.setPreview(null)"
            @focus="selection.setPreview(c, 'drop')"
            @blur="selection.setPreview(null)"
            @click="emit('select', c)"
          >
            {{ c.name }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.timetable-wrap {
  overflow-x: auto;
}
.timetable {
  display: grid;
  grid-template-columns: 2.5em repeat(7, minmax(78px, 1fr));
  gap: 3px;
  min-width: 600px;
}
.head {
  text-align: center;
  font-weight: 700;
  padding: 2px 0;
  border-radius: 8px;
  background: rgba(124, 92, 255, 0.12);
}
.head.corner {
  background: transparent;
}
.period {
  display: grid;
  place-items: center;
  font-size: 12px;
  opacity: 0.65;
}
.cell {
  min-height: 34px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.08);
  display: grid;
  gap: 2px;
  align-content: start;
  transition: background-color 0.15s;
}
.cell-preview {
  background: rgba(124, 92, 255, 0.28);
}
.cell-conflict {
  background: rgba(229, 25, 59, 0.35);
}
.chip {
  width: 100%;
  padding: 3px 4px;
  border: 0;
  border-radius: 6px;
  background: color-mix(in srgb, var(--chip) 22%, transparent);
  border-left: 3px solid var(--chip);
  color: inherit;
  font: inherit;
  font-size: 12px;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip:hover,
.chip:focus-visible {
  background: color-mix(in srgb, var(--chip) 40%, transparent);
  outline: none;
}
</style>
