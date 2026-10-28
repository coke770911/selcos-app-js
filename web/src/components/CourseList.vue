<script setup lang="ts">
import { NEmpty, NSpin, useOsTheme } from 'naive-ui';
import type { CourseListItem } from '@selcos/shared';
import { COURSE_KIND_COLORS } from '@/courseKind';
import { useSelectionStore } from '@/stores/selection';

/** 課程清單（舊系統 #cos_list）：hover 預覽節次與學分，點選開啟課程資訊 */
defineProps<{ items: CourseListItem[]; loading: boolean }>();
const emit = defineEmits<{ select: [course: CourseListItem] }>();

const selection = useSelectionStore();
const osTheme = useOsTheme();
const colorOf = (c: CourseListItem) =>
  COURSE_KIND_COLORS[c.label.kind][osTheme.value === 'dark' ? 'dark' : 'light'];

function select(course: CourseListItem) {
  // 手機沒有 hover：點選時先標示節次，再開課程資訊
  selection.setPreview(course, 'add');
  emit('select', course);
}
</script>

<template>
  <NSpin :show="loading">
    <NEmpty v-if="!loading && items.length === 0" description="查無課程清單" class="py-6" />
    <ul v-else class="course-list">
      <li v-for="c in items" :key="`${c.cosId}-${c.cosClass}-${c.cosTerm}`">
        <button
          type="button"
          class="course-item"
          :style="{ '--kind': colorOf(c) }"
          @mouseenter="selection.setPreview(c, 'add')"
          @mouseleave="selection.setPreview(null)"
          @focus="selection.setPreview(c, 'add')"
          @blur="selection.setPreview(null)"
          @click="select(c)"
        >
          <span class="tag">{{ c.label.tag }}</span>
          <span class="name">{{ c.name }}</span>
          <span class="credit">{{ c.credit }} 學分</span>
        </button>
      </li>
    </ul>
  </NSpin>
</template>

<style scoped>
.course-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
  max-height: calc(100vh - 360px);
  min-height: 160px;
  overflow-x: hidden;
  overflow-y: auto;
}
.course-item {
  width: 100%;
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 10px;
  border: 0;
  border-left: 4px solid var(--kind);
  border-radius: 10px;
  background: transparent;
  color: var(--kind);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.15s,
    transform 0.15s;
}
.course-item:hover,
.course-item:focus-visible {
  background: color-mix(in srgb, var(--kind) 14%, transparent);
  transform: translateX(2px);
  outline: none;
}
.tag {
  flex: none;
  font-size: 12px;
  font-weight: 700;
}
.name {
  flex: 1;
  font-weight: 600;
}
.credit {
  flex: none;
  font-size: 12px;
  opacity: 0.75;
}
</style>
