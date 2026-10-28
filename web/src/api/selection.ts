import type { EnrollRequest, SelectionState } from '@selcos/shared';
import { http } from './http';

const path = (k: EnrollRequest) =>
  `/selection/${encodeURIComponent(k.cosId)}/${encodeURIComponent(k.cosClass)}/${encodeURIComponent(k.cosTerm)}`;

export const selectionApi = {
  state: () => http.get<SelectionState>('/selection').then((r) => r.data),
  add: (key: EnrollRequest) => http.post<SelectionState>('/selection', key).then((r) => r.data),
  drop: (key: EnrollRequest) => http.delete<SelectionState>(path(key)).then((r) => r.data),
};
