import { COURSE_KIND_COLORS } from '@/courseKind';
import { useThemeStore } from '@/stores/theme';

/** @import { CourseKind } from '@selcos/shared' */

/** 依目前亮色／暗色主題取課程類別顏色 */
export function useKindColor() {
  const theme = useThemeStore();
  return (/** @type {CourseKind} */ kind) =>
    COURSE_KIND_COLORS[kind][theme.isDark ? 'dark' : 'light'];
}
