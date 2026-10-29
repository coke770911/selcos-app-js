// Express Request 擴充：requireAuth 通過後才有 req.auth（JSDoc 無法宣告模組擴充，改用宣告檔）
import type { MeResponse } from '@selcos/shared';
import type { SessionClaims } from './auth/token.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { claims: SessionClaims; me: MeResponse };
  }
}
