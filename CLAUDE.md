# selcos-app

亞東科技大學選課系統重構版（PHP → Node.js + Express + JWT ／ Vue 3 + Vite）。舊系統在 `D:\project\selcos`，功能以舊系統為準。完整規劃見 [PLAN.md](PLAN.md)，指令與部署見 [README.md](README.md)。

## 鐵則

- **正式機資料庫 `172.16.29.1` 開發期間禁止任何讀寫**（包含查詢、`prisma db pull`、測試或比對腳本）。開發與測試一律連測試機。程式內的防呆（`server/src/config/dbGuard.ts`）不可移除或繞過。
- 正式機的 SP 與表結構不可修改；新 SP 只能在測試機實驗。不使用 `prisma migrate`。
- 畫面與操作行為維持與舊系統一致（RWD、點選清單／節次、彈窗加退選）。

## 重構原則

1. **禁止修改測試案例本身來讓測試通過**（除非該測試與新介面規範明確衝突，且需說明是哪個規範改變）。測試失敗時修正實作。
2. **優先提取共同元件、減少依賴耦合、遵循既有代碼風格**（命名、註解密度、檔案結構與周圍程式一致）。
3. **每次修改聚焦單一模組，不要一次全盤翻寫。** 改完一個模組就驗證（測試、型別檢查、lint）再進行下一個。

## 專案慣例

- npm workspaces：`shared/`（前後端共用型別）、`server/`、`web/`、`deploy/`。
- 設定只有一個檔案 `server/.env`：`NODE_ENV=production` 讀 `DB_*`，其他模式讀 `TEST_DB_*`，不會退回使用正式參數。
- 前端打包輸出到 `server/public`，由 Express 提供；正式環境只有一個 port（3000）。
- 認證走 JWT（`jti` 做單一登入比對），不使用舊版 PHP session；登入紀錄不寫 `log_session_id`。
- 正式環境有負載平衡（多台伺服器）：共用狀態（有效 jti、驗證碼）一律經 `CacheStore` 存到 `[CACHE].[dbo].[tb_Session]`（`CACHE_DRIVER=sqlserver`，key 前綴 `selcos-app:`），不可放在程序記憶體；各台 `JWT_SECRET` 相同。
- 後端相依物件由 `server/src/container.ts` 組裝並注入，測試用假的 repository／AD（`server/test/helpers.ts`）。
- 寫入舊資料表前要配合欄位長度（例如 `cos_std_loginoutlog`）。
- 前端**不使用 jQuery**，也**不使用 `alert` / `confirm` / `prompt`** 等會阻擋瀏覽器的語法（ESLint 會擋）。彈窗用共用元件 `web/src/components/NoticeDialog.vue` 寫在 template 裡（不用 `useDialog` 的命令式寫法），提示用 Naive UI 的 message。
- 舊系統的 PHP 寫法不合適時改用 Node.js / Vue 的方式重寫（例如 session 累加狀態改成即時計算、`die()` 改統一錯誤處理），業務規則不變，並說明改了什麼。
- 檢查指令：`npm test`、`npm run typecheck`、`npm run lint`、`npm run format`、`npm run build`。
