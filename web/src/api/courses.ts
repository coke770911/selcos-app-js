import type { CourseFilters, CourseInfo, CourseListItem } from '@selcos/shared';
import { http } from './http';

export type CourseQuery =
  | { mode: 'dept'; deptNo: string; year: string }
  | { mode: 'time'; weekday: string; period: string };

export const coursesApi = {
  filters: () => http.get<CourseFilters>('/courses/filters').then((r) => r.data),
  list: (query: CourseQuery) =>
    http.get<CourseListItem[]>('/courses', { params: query }).then((r) => r.data),
  info: (key: { cosId: string; cosClass: string; cosTerm: string }) =>
    http
      .get<CourseInfo>(
        `/courses/${encodeURIComponent(key.cosId)}/${encodeURIComponent(key.cosClass)}/${encodeURIComponent(key.cosTerm)}`,
      )
      .then((r) => r.data),
};
