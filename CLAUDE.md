# selcos-app-js

亞東科技大學選課系統重構版（PHP → Node.js + Express + Sequelize + JWT ／ Vue 3 + Vite，前後端皆為 JavaScript + JSDoc）。舊系統在 `D:\project\selcos`，功能以舊系統為準。完整規劃見 [PLAN.md](PLAN.md)，指令與部署見 [README.md](README.md)。

## 鐵則

- **正式機資料庫 `172.16.29.1` 開發期間只能查詢（`SELECT`），禁止任何寫入**：不可執行 `INSERT`／`UPDATE`／`DELETE`／`MERGE`、會寫入資料的 SP（例如加退選 SP），也不可對正式機跑測試或會寫入的腳本。開發與測試一律連測試機。程式內的防呆（`server/src/config/dbGuard.js`）不可移除或繞過：非 production 模式的程式仍不可連正式機，需要查正式機資料時另外用唯讀帳號手動查詢。
- 正式機的 SP 與表結構不可修改；新 SP 只能在測試機實驗。不使用 Sequelize 的 `sync`、migration 或任何會改動資料表的功能。
- 畫面與操作行為維持與舊系統一致（RWD、點選清單／節次、彈窗加退選）。

## 重構原則

1. **禁止修改測試案例本身來讓測試通過**（除非該測試與新介面規範明確衝突，且需說明是哪個規範改變）。測試失敗時修正實作。
2. **優先提取共同元件、減少依賴耦合、遵循既有代碼風格**（命名、註解密度、檔案結構與周圍程式一致）。
3. **每次修改聚焦單一模組，不要一次全盤翻寫。** 改完一個模組就驗證（測試、型別檢查、lint）再進行下一個。

## 型別規則（強型別）

開發中嚴格驗證變數型態，程式一律以強型別的方式撰寫：

- `tsconfig.base.json` 的 `strict`、`noUncheckedIndexedAccess` 等嚴格選項不可關閉或放寬；`npm run typecheck` 有錯誤就不算完成。
- 每個函式的參數與回傳值都要用 JSDoc 標型別（`@param`、`@returns`）；物件結構用 `@typedef` 定義欄位，不用籠統的 `{object}`、`{Object}`、`{*}`、`{Function}` 當參數或欄位型別。
- 不使用 `any`，型別不明時用 `unknown` 再收斂（`typeof`、`instanceof`、zod 解析）。不使用 `@ts-ignore`、`@ts-nocheck`、`@ts-expect-error` 壓掉錯誤；泛型邊界（例如 `SqlRunner` 的查詢結果）真的需要 `@type` 轉型時，要寫註解說明原因。
- 外部輸入一律在邊界用 zod 驗證後才使用：`req.body`／`req.params`／`req.query`、`server/.env`；資料庫查詢結果要有對應的 row `@typedef`，欄位可能為 `null` 時要標出來。
- 比較一律用 `===`／`!==`；型別轉換要明確（`Number()`、`String()`、`Boolean()`），不依賴隱式轉換，轉成數字後要檢查 `Number.isFinite`／`Number.isInteger`。ESLint 以 `eqeqeq`、`no-implicit-coercion` 與自訂的 `typing/no-ts-directive`（`eslint.config.js`）檢查。
- 共用的資料結構（API 請求與回應）定義在 `shared/`，前後端共用同一個型別，不各自重寫。

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
- 資料存取用 Sequelize（dialect `mssql`、驅動 tedious）執行原生 SQL：一律經 `server/src/db/sequelize.js` 的 `SqlRunner`（`select`／`execute`），參數用 `bind`（`$名稱`），不可字串拼接；不定義 model。tedious 把字串參數送成 `nvarchar`，`WHERE`／`JOIN` 條件和 `varchar`／`char` 欄位比較時要寫 `CAST($名稱 AS varchar(50))`，否則無法完整使用索引（`EXEC` 預存程序的參數不受影響）。加退選交易用 `sequelize.transaction` managed transaction。
- 程式一律寫 JavaScript（ES modules），型別用 JSDoc（`@typedef`、`@param`、`@import`）標註，`npm run typecheck`（`checkJs`）必須通過；Express 的 `req.auth` 擴充放在 `server/src/express.d.ts`。Vue 元件的 props／emits 用執行期宣告並以 JSDoc 標型別。
- 寫入舊資料表前要配合欄位長度（例如 `cos_std_loginoutlog`）。
- 前端**不使用 jQuery**，也**不使用 `alert` / `confirm` / `prompt`** 等會阻擋瀏覽器的語法（ESLint 會擋）。彈窗用共用元件 `web/src/components/NoticeDialog.vue` 寫在 template 裡（不用 `useDialog` 的命令式寫法），提示用 Naive UI 的 message。
- 舊系統的 PHP 寫法不合適時改用 Node.js / Vue 的方式重寫（例如 session 累加狀態改成即時計算、`die()` 改統一錯誤處理），業務規則不變，並說明改了什麼。
- 檢查指令：`npm test`、`npm run typecheck`、`npm run lint`、`npm run format`、`npm run build`。
