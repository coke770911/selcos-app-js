# selcos-app-js

亞東科技大學選課系統重構版（PHP → Node.js + Express + Sequelize + JWT ／ Vue 3 + Vite，前後端皆為 JavaScript + JSDoc）。舊系統在 `D:\project\selcos`，功能以舊系統為準。完整規劃見 [PLAN.md](PLAN.md)，指令與部署見 [README.md](README.md)。

## 鐵則

- **正式機資料庫 `172.16.29.1` 開發期間禁止任何讀寫**（包含查詢、測試、檢查或比對腳本）。開發與測試一律連測試機。程式內的防呆（`server/src/config/dbGuard.js`）不可移除或繞過。
- 正式機的 SP 與表結構不可修改；新 SP 只能在測試機實驗。不使用 Sequelize 的 `sync`、migration 或任何會改動資料表的功能。
- 畫面與操作行為維持與舊系統一致（RWD、點選清單／節次、彈窗加退選）。

## 重構原則

1. **禁止修改測試案例本身來讓測試通過**（除非該測試與新介面規範明確衝突，且需說明是哪個規範改變）。測試失敗時修正實作。
2. **優先提取共同元件、減少依賴耦合、遵循既有代碼風格**（命名、註解密度、檔案結構與周圍程式一致）。
3. **每次修改聚焦單一模組，不要一次全盤翻寫。** 改完一個模組就驗證（測試、型別檢查、lint）再進行下一個。

## 版本規則

- 系統版本號唯一來源是根目錄 `package.json`（`主.次.修訂`），後端由 `server/src/config/version.js` 讀取並經 `/api/health`、`/api/public/app-info` 提供給前端顯示。
- **每次 commit 前必須執行 `npm run version:bump`，修訂號 +1**（同步更新所有 workspace 的 package.json 與 package-lock.json），並與該次修改一起提交。
- commit 訊息第一行以版本開頭，例如 `v1.0.1 修正課表顯示`。
- 主版號、次版號只在使用者要求時調整。

## 專案慣例

- npm workspaces：`shared/`（前後端共用型別）、`server/`、`web/`、`deploy/`。
- 設定只有一個檔案 `server/.env`：`NODE_ENV=production` 讀 `DB_*`，其他模式讀 `TEST_DB_*`，不會退回使用正式參數。
- 前端打包輸出到 `server/public`，由 Express 提供；正式環境只有一個 port（3000）。
- 認證走 JWT（`jti` 做單一登入比對），不使用舊版 PHP session；登入紀錄不寫 `log_session_id`。
- 正式環境有負載平衡（多台伺服器）：共用狀態（有效 jti、驗證碼）一律經 `CacheStore` 存到 `[CACHE].[dbo].[tb_Session]`（`CACHE_DRIVER=sqlserver`，key 前綴 `selcos-app:`），不可放在程序記憶體；各台 `JWT_SECRET` 相同。
- 後端相依物件由 `server/src/container.js` 組裝並注入，測試用假的 repository／AD（`server/test/helpers.js`）。
- 資料存取用 Sequelize（dialect `mssql`、驅動 tedious）執行原生 SQL：一律經 `server/src/db/sequelize.js` 的 `SqlRunner`（`select`／`execute`），參數用 `bind`（`$名稱`），不可字串拼接；不定義 model。加退選交易用 `sequelize.transaction` managed transaction。
- 程式一律寫 JavaScript（ES modules），型別用 JSDoc（`@typedef`、`@param`、`@import`）標註，`npm run typecheck`（`checkJs`）必須通過；Express 的 `req.auth` 擴充放在 `server/src/express.d.ts`。Vue 元件的 props／emits 用執行期宣告並以 JSDoc 標型別。
- 寫入舊資料表前要配合欄位長度（例如 `cos_std_loginoutlog`）。
- 前端**不使用 jQuery**，也**不使用 `alert` / `confirm` / `prompt`** 等會阻擋瀏覽器的語法（ESLint 會擋）。彈窗用共用元件 `web/src/components/NoticeDialog.vue` 寫在 template 裡（不用 `useDialog` 的命令式寫法），提示用 Naive UI 的 message。
- 舊系統的 PHP 寫法不合適時改用 Node.js / Vue 的方式重寫（例如 session 累加狀態改成即時計算、`die()` 改統一錯誤處理），業務規則不變，並說明改了什麼。
- 檢查指令：`npm test`、`npm run typecheck`、`npm run lint`、`npm run format`、`npm run build`。
