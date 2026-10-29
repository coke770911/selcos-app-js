import { http } from './http';

/** @import { EnrollRequest, SelectionState } from '@selcos/shared' */

/** @param {EnrollRequest} k */
const path = (k) =>
  `/selection/${encodeURIComponent(k.cosId)}/${encodeURIComponent(k.cosClass)}/${encodeURIComponent(k.cosTerm)}`;

export const selectionApi = {
  /** @returns {Promise<SelectionState>} */
  state: () => http.get('/selection').then((r) => r.data),
  /**
   * @param {EnrollRequest} key
   * @returns {Promise<SelectionState>}
   */
  add: (key) => http.post('/selection', key).then((r) => r.data),
  /**
   * @param {EnrollRequest} key
   * @returns {Promise<SelectionState>}
   */
  drop: (key) => http.delete(path(key)).then((r) => r.data),
};
