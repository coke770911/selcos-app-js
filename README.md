# 選課系統（selcos-app）

亞東科技大學選課系統重構版，版本 **1.0.1**（以根目錄 `package.json` 為準）。

由舊系統（PHP，位於 `D:\project\selcos`）重構為 Node.js + Express + Sequelize ／ Vue 3（前後端皆為 JavaScript，以 JSDoc 標註型別）。功能、規則與操作方式以舊系統為準。

> 此版本由 Prisma／TypeScript 版（v1.0.0）改寫而來：資料存取改用 Sequelize，程式改為 JavaScript，API、業務規則與畫面行為不變。

> ⚠️ 正式機資料庫 `172.16.29.1` 開發期間禁止任何讀寫。非 production 模式指向正式機（含網域名稱解析）時，API 與所有檢查、比對腳本都會拒絕執行。

相關文件：

- [PLAN.md](PLAN.md)：重構規劃
- [CLAUDE.md](CLAUDE.md)：開發規則與專案慣例
- [docs/選課系統-加退選規則與API.pdf](docs/選課系統-加退選規則與API.pdf)：加退選規則、同時選課防護與 API

## 目前進度

| 階段 | 內容                                                                       | 狀態   |
| ---- | -------------------------------------------------------------------------- | ------ |
| 0    | 專案骨架、環境模式、正式機防呆、測試機連線                                 | ✅     |
| 1    | 驗證碼、AD 登入、管理員代登、JWT 單一登入、登入／登出紀錄、被踢下線通知    | ✅     |
| 2    | 選課前置資料：開放條件、問卷、虛擬年級、學分上下限、通識次數、重修補修清單 | ✅     |
| 3    | 課程查詢（依系所／依節次）、類別標示、課程資訊                             | ✅     |
| 4    | 加退選規則、同時選課防護（交易＋鎖定）、課表                               | ✅     |
| 5    | 前端收尾：RWD 細節、手機操作                                               | 進行中 |
| 6    | 新舊系統在測試機並行比對                                                   | 待辦   |
| 7    | PM2 + IIS ARR 部署、壓力測試、上線切換                                     | 待辦   |

已完成的其他功能：亮色／暗色主題（預設跟隨系統）、負載平衡共用快取（`CACHE.tb_Session`）。

## 技術架構

| 層   | 技術                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| 後端 | Node.js 24、Express 5、Sequelize 6 + tedious（SQL Server，沿用既有 SP）、ldapts、JWT |
| 前端 | Vue 3、Vite 8、Pinia、Vue Router、Naive UI、UnoCSS                                   |
| 型別 | JavaScript（ES modules）+ JSDoc，`tsc`／`vue-tsc` 以 `checkJs` 檢查，不編譯          |
| 測試 | Vitest、supertest（後端 180+ 個測試）、新舊邏輯比對腳本                              |
| 部署 | PM2 + IIS ARR；前端打包進後端，正式環境只有一個 port（3000）                         |

## 目錄結構

| 目錄      | 說明                                                                                       |
| --------- | ------------------------------------------------------------------------------------------ |
| `shared/` | 前後端共用型別與錯誤代碼                                                                   |
| `server/` | API：`config`（環境、防呆）、`auth`、`cache`、`db`、`domain`（規則）、`services`、`routes` |
| `web/`    | 前端：`views`、`components`、`stores`、`composables`；打包輸出到 `server/public`           |
| `deploy/` | PM2（`ecosystem.config.cjs`）與 IIS ARR（`web.config`）設定                                |
| `docs/`   | 技術文件                                                                                   |

## 資料存取（Sequelize）

- 連線設定在 `server/src/db/connectionConfig.js`（dialect `mssql`、驅動 tedious、`useUTC: false`），由 `server/src/db/sequelize.js` 延遲建立。
- 查詢一律是原生 SQL（SP、View、跨資料庫 `[CACHE]`），經 `SqlRunner`（`select`／`execute`）呼叫 `sequelize.query`，參數用 `bind`（SQL 內寫 `$名稱`）交給 tedious 參數化，不做字串拼接。
- 不定義 model、不使用 `sync` 或 migration，不會改動任何資料表。
- 加退選用 Sequelize managed transaction：`SET XACT_ABORT ON` 後依序 `sp_getapplock`（先學生、後課程，逾時 10 秒回 503），任何錯誤自動 rollback。

## 環境設定

整個系統只有一個設定檔 `server/.env`（範本 `server/.env.example`），同一個檔案放正式與測試兩組參數，用 `NODE_ENV` 切換：

| 模式     | NODE_ENV      | 讀取的參數                         | 自動預設                          |
| -------- | ------------- | ---------------------------------- | --------------------------------- |
| 測試模式 | `development` | `TEST_DB_*`、`TEST_ADMIN_ACCOUNTS` | 標題 `[測試]`、選課 5 小時、debug |
| 正式模式 | `production`  | `DB_*`、`ADMIN_ACCOUNTS`           | 無後綴、選課 30 分鐘、info        |

- 測試模式不會退回使用正式參數，`TEST_DB_HOST` 沒填就無法啟動。
- 未設定 `NODE_ENV` 時預設為 `development`；已存在的系統環境變數不會被 `.env` 覆寫。
- `CACHE_DRIVER=sqlserver`（預設）：登入狀態與驗證碼存在 `[CACHE].[dbo].[tb_Session]`，負載平衡的多台伺服器共用。
- 負載平衡的每台伺服器 `JWT_SECRET` 必須相同。
- 前端沒有自己的 env 檔，標題、版本等由 `GET /api/public/app-info` 提供。

## 開發

```bash
npm install
cp server/.env.example server/.env   # 填入 TEST_DB_* 測試機帳密與 JWT_SECRET
npm run dev:server                   # API：http://localhost:3000/api/health
npm run dev:web                      # 前端：http://localhost:5173（/api 轉給 3000）
```

也可以 `npm run build -w web` 後只開 `npm run dev:server`，用 http://localhost:3000 測試與正式環境相同的單一 port。

### 常用指令

| 指令                               | 說明                                          |
| ---------------------------------- | --------------------------------------------- |
| `npm test`                         | 後端測試                                      |
| `npm run typecheck`                | 前後端型別檢查（JSDoc，`checkJs`）            |
| `npm run lint` ／ `npm run format` | ESLint ／ Prettier                            |
| `npm run build`                    | 後端型別檢查、打包前端到 `server/public`      |
| `npm run version:bump`             | 版本修訂號 +1（所有 package.json 與 lock 檔） |

### 測試機檢查與新舊比對（都只連測試機）

| 指令                                        | 說明                                   |
| ------------------------------------------- | -------------------------------------- |
| `npm run check:db -w server -- 學號`        | 連線與學籍查詢（只做 SELECT）          |
| `npm run check:ldap -w server -- 帳號`      | AD 驗證（密碼從鍵盤輸入）              |
| `npm run check:cache -w server`             | 共用快取讀寫檢查（自行清除測試資料）   |
| `npm run compare:context -w server -- 200`  | 選課前置資料新舊邏輯比對（抽樣，只讀） |
| `npm run compare:label -w server -- 40`     | 課程類別標示新舊邏輯比對（抽樣，只讀） |
| `npm run compare:enroll -w server -- 40 40` | 加退選規則新舊邏輯比對（抽樣，只讀）   |

## 部署（IIS ARR + PM2）

需求：Node.js **24**（≥22）、PM2、IIS URL Rewrite + ARR。後端直接以 Node 執行 `server/src`，不需編譯。

```bash
npm install -g pm2
git clone <儲存庫網址> selcos-app
cd selcos-app
npm ci
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

1. 正式主機放 `server/.env`（`NODE_ENV=production`、正式機 `DB_*`、各台相同的 `JWT_SECRET`）。
2. IIS 站台放入 `deploy/web.config`，把所有請求轉給 `localhost:3000`。
3. Windows 開機自動啟動：`npm install -g pm2-windows-startup` 後執行 `pm2-startup install`。

更新版本：`git pull` → `npm ci` → `npm run build` → `pm2 reload selcos-api`。

常用：`pm2 status`、`pm2 logs selcos-api`、`pm2 restart selcos-api`、`pm2 monit`。

## 版本規則

- 版本號格式為 `主版號.次版號.修訂號`，唯一來源是根目錄 `package.json`，後端啟動時讀取，顯示在登入頁與選課畫面頂端列。
- **每次 commit 前執行 `npm run version:bump`，修訂號 +1**（例如 1.0.0 → 1.0.1），commit 訊息開頭標示版本，例如 `v1.0.1 修正…`。
- 主版號、次版號由專案負責人決定何時調整。
