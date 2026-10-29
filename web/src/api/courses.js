import { http } from './http';

/** @import { CourseFilters, CourseInfo, CourseListItem } from '@selcos/shared' */

/**
 * @typedef {{ mode: 'dept'; deptNo: string; year: string }
 *   | { mode: 'time'; weekday: string; period: string }} CourseQuery
 */

export const coursesApi = {
  /** @returns {Promise<CourseFilters>} */
  filters: () => http.get('/courses/filters').then((r) => r.data),
  /**
   * @param {CourseQuery} query
   * @returns {Promise<CourseListItem[]>}
   */
  list: (query) => http.get('/courses', { params: query }).then((r) => r.data),
  /**
   * @param {{ cosId: string; cosClass: string; cosTerm: string }} key
   * @returns {Promise<CourseInfo>}
   */
  info: (key) =>
    http
      .get(
        `/courses/${encodeURIComponent(key.cosId)}/${encodeURIComponent(key.cosClass)}/${encodeURIComponent(key.cosTerm)}`,
      )
      .then((r) => r.data),
};
