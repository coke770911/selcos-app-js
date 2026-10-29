# 選課系統重構規劃（selcos → selcos-app-js）

舊系統：`D:\project\selcos`（PHP 7.4 + IIS + SQL Server）
新系統：Node.js 24（≥22）+ Express 5 + Sequelize 6（mssql／tedious）／ Vue 3 + Vite 8 + Naive UI + UnoCSS（npm workspaces）；前後端皆為 JavaScript（ES modules）+ JSDoc，以 `tsc`／`vue-tsc` 的 `checkJs` 做型別檢查

> v1.0.1 起由 TypeScript + Prisma 7 改為 JavaScript + Sequelize：原本的 `$queryRaw`／`$executeRaw` 改為 `sequelize.query` 搭配 `bind` 參數，`$transaction` 改為 Sequelize managed transaction，不定義 model、不使用 sync／migration；API、業務規則與畫面不變。

---

## 0. 鐵則

- **正式機資料庫 `172.16.29.1` 開發期間禁止任何 CRUD**（包含檢查腳本、測試腳本、比對腳本）。開發與測試一律連測試機。
  - 程式層防呆：非 `production` 模式時，`DB_HOST` 若為 `172.16.29.1` 直接拒絕啟動。
  - 檢查與比對腳本（`check:*`、`compare:*`）連線前同樣檢查，指向正式機就中止。
- **正式機 SP 不修改**；新 SP 只在測試機實驗。
- **正式機只新增資料、不改結構**：登入紀錄繼續寫 `cos_std_loginoutlog`。
- 不使用 Sequelize 的 `sync`／migration，不改動任何資料表。
- 畫面、操作行為與舊系統一致（RWD、點選節次／清單的操作模式不變），只換技術與視覺風格。

---

## 1. 環境模式（Node.js 風格）

以 `NODE_ENV` 區分模式，取代舊系統 `TESTMODE`（舊系統 `TESTMODE=1` 為正式，命名相反，不沿用）。

**整個系統只有一個設定檔 `server/.env`**，同一個檔案放正式與測試兩組參數（同舊系統 `env.php` 的 `DB_*` / `TESTDB_*`），用 `NODE_ENV` 切換；範本為 `server/.env.example`。API、檢查腳本、PM2 都讀同一份檔案，PM2 設定不另外指定 `NODE_ENV`。已存在的系統環境變數不會被覆寫；未設定時預設 `development`。啟動時用 zod 驗證，缺參數直接中止，錯誤訊息會顯示實際該填的參數名稱（例如 `TEST_DB_HOST`）。

| 參數                     | development（測試）                 | production（正式）             | 舊系統對應       |
| ------------------------ | ----------------------------------- | ------------------------------ | ---------------- |
| `NODE_ENV`               | development                         | production                     | `TESTMODE`       |
| 資料庫連線               | `TEST_DB_HOST/PORT/NAME/USER/PASS…` | `DB_HOST/PORT/NAME/USER/PASS…` | `TDB_*` / `DB_*` |
| 管理員名單               | `TEST_ADMIN_ACCOUNTS`               | `ADMIN_ACCOUNTS`               | `$adminArray`    |
| `APP_TITLE_SUFFIX`       | 預設 `[測試]`                       | 預設空白                       | `$title_mode`    |
| `SESSION_TTL_SECONDS`    | 預設 18000                          | 預設 1800                      | `$SYSTEMTIME`    |
| `LOG_LEVEL`              | 預設 debug                          | 預設 info                      | —                |
| `LDAP_URL / LDAP_DOMAIN` | 共用                                | 共用                           | `login_check()`  |
| `JWT_SECRET`             | 共用                                | 共用                           | —                |
| `CACHE_DRIVER`           | sqlserver                           | sqlserver                      | `tb_Session`     |

測試模式不會退回使用正式參數；`TEST_DB_HOST` 填成 `172.16.29.1` 會被防呆擋下。

前端沒有 env 檔，標題後綴、版本等由 `GET /api/public/app-info` 提供。

---

## 2. 舊系統功能對照

| 舊檔案                 | 功能                                                                                                                  | 新系統                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `index.php`            | 登入頁、開放時段公告、線上人數                                                                                        | `LoginView`、`GET /api/public/schedule`、`/api/public/online` |
| `captcha.php`          | 驗證碼                                                                                                                | `GET /api/auth/captcha`                                       |
| `process.php`          | AD 驗證、管理員代登、學籍、時段／年級／延修／轉學生／問卷檢查、及格與不及格、通識次數、學分上下限、補修清單、登入紀錄 | `POST /api/auth/login` + `SelectionContextService`            |
| `processapi.php`       | App 登入                                                                                                              | **不重構**                                                    |
| `selcos_main.php`      | 主畫面、課表、學分、倒數、防多開                                                                                      | `SelectionView`、`GET /api/selection/me`                      |
| `ajax_selcos_kind.php` | 學制、系所選單                                                                                                        | `GET /api/courses/filters`                                    |
| `ajax_selcos_list.php` | 依系所年級／星期節次查課                                                                                              | `GET /api/courses`                                            |
| `selcos_cos_info.php`  | 課程資訊                                                                                                              | `GET /api/courses/:smtr/:id/:class/:term`                     |
| `ajax_cos_add.php`     | 加選                                                                                                                  | `POST /api/selection`                                         |
| `ajax_cos_del.php`     | 退選                                                                                                                  | `DELETE /api/selection`                                       |
| `selcos_logout.php`    | 登出紀錄                                                                                                              | `POST /api/auth/logout`                                       |

---

## 3. 架構

```
selcos-app-js/
├─ shared/            前後端共用型別、錯誤代碼
├─ server/
│  ├─ public/         前端打包結果（vite build 輸出，不進版控）
│  └─ src/
│     ├─ config/      env 載入與驗證、正式機防呆
│     ├─ cache/       CacheStore 介面 + memory（之後 redis/Garnet）
│     ├─ db/          Sequelize 連線、SqlRunner、repositories、lock（sp_getapplock）
│     ├─ auth/        ldap、jwt、captcha、middleware
│     ├─ domain/      gecClassifier、cosTypeLabel
│     ├─ rules/       加選／退選規則（每條一支純函式）
│     ├─ services/    selectionContext、courseList、enroll、drop
│     └─ routes/
├─ web/src/
│  ├─ views/          LoginView、SelectionView
│  ├─ components/     CourseFilter、CourseList、Timetable、CourseInfoDialog、TopBar、NoticeDialog
│  ├─ stores/         auth、selection
│  └─ api/
└─ deploy/            ecosystem.config.cjs（PM2）、web.config（IIS ARR）
```

**部署架構（單一 port）**：前端 `vite build` 輸出到 `server/public`，由 Express 提供畫面（Vue Router 頁面回傳 index.html）與 `/api`。正式環境只有 Node 的 3000 port，IIS ARR 把所有請求轉給它。開發時可另開 Vite（5173）即時更新畫面。

### 3.1 JWT 與狀態

- JWT 只放身分：`std_no`、`role`（user/admin）、`adminId`、`smtr`、`mode`、`sid`；`exp` = `SESSION_TTL_SECONDS`，前端倒數依 `exp`。
- 登入時算好的資料（學籍、及格／不及格、補修、通識次數、學分上下限、選課參數）存快取，key = `std_no:sid`。
- 本學期已選課程（衝堂、目前學分、通識已選次數）每次從 DB 即時計算。
- 單一登入：快取存 `activeSid[std_no]`，不一致回 401。防多開分頁改用 `BroadcastChannel`。
- 驗證碼：`captchaId` + 快取 2 分鐘、只能用一次。
- Token 放 `Authorization: Bearer`，前端存 sessionStorage。

### 3.2 管理員

- `學號/管理員帳號` 代登，名單放 `ADMIN_ACCOUNTS`（逗號分隔、不分大小寫）。
- 只有 `role=admin` 跳過時段、年級、問卷檢查（取代舊系統寫死的 `$isAdmin = 1`）。
- ⚠️ 舊系統寫死 `$isAdmin = 1` 會讓一般學生也跳過檢查，上線前需與教務處確認時段設定。

### 3.3 快取

- 正式環境有**負載平衡（多台伺服器）**，登入狀態（有效的 jti）與驗證碼必須共用，不能放各台記憶體。
- 預設 `CACHE_DRIVER=sqlserver`：沿用舊系統的 `[CACHE].[dbo].[tb_Session]`（不改表結構，舊系統也是用它讓多台伺服器共用 session）。
  - `php_sessID` = `selcos-app:` + key、`php_sessionValue` = JSON、`php_login` = 建立時間、`php_time` = 到期時間（Unix 秒）、`php_stdno` = `guest`
  - 時間取資料庫伺服器時間；定期清除只刪 `selcos-app:` 開頭的過期資料，不動舊系統資料
  - 舊系統 gc 會刪除 `php_login` 超過 30 分鐘的資料：正式模式選課時間也是 30 分鐘，不受影響；測試模式（5 小時）若舊系統同時連測試機，可能提早登出
- `memory` 只適用單一伺服器、單一程序（單元測試、單機開發）。
- 每台伺服器的 `JWT_SECRET` 必須相同。
- 檢查：`npm run check:cache -w server`（與記憶體版跑同一套共用檢查）。

### 3.4 同時選課（不改正式機 SP）

```
BEGIN TRAN
  sp_getapplock 'stu:{std_no}'
  sp_getapplock 'cos:{smtr}:{id}:{class}:{term}'
  重新查已選課程與課程人數 → 規則引擎
  EXEC selcos_ins_cos_smtr_stdregi ...（現有 SP）
COMMIT
```

lock 順序固定先學生再課程。需先在測試機確認現有 SP 的交易與 rollback 行為。

### 3.5 規則引擎

加選規則依序：特殊課號黑名單 → 112 學年後世界文明限制 → 一年級課程限制 → 本學期已選／核通同類 → 衝堂 → 學分上限 → 已及格 → 體育門數 → 核通各類一次 → 博雅門數 → 人數上限 → 重修／補修判定（改 R/S、跳過條件檢查）→ 可加選／同學制／年級／同系／指定系所 → 同性質課程 → 暑修改 J。
退選規則：可否退（重補修例外）→ 人數下限（延修生例外）→ 學分下限。

### 3.6 舊系統待修問題

1. `$isAdmin = 1` 寫死（見 3.2）
2. `TESTMODE` 命名相反
3. 管理員名單寫死
4. `?seid=` session fixation
5. 課程資訊 XSS
6. `ajax_selcos_kind.php` 字串拼 SQL
7. 指定系所錯誤訊息 JSON 寫成 `" code":" 100 "`
8. 口頭特例課號整理成清單給承辦確認

---

## 4. API

```
GET    /api/health
GET    /api/public/schedule
GET    /api/public/online
GET    /api/auth/captcha
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/selection/me
GET    /api/courses/filters
GET    /api/courses?mode=dept&dept_no&degree | ?mode=time&week&period
GET    /api/courses/:smtr/:id/:class/:term
POST   /api/selection
DELETE /api/selection
```

錯誤格式統一 `{ code, message }` + HTTP status。

---

## 5. 前端（操作照舊）

- 左側：依系所（學制 → 系所 → 年級）／依節次（星期 → 節次）→ 查詢 → 清單
- 清單 hover：課表標示節次、學分顯示 `+N`；點選 → 課程資訊彈窗 → 加選
- 右側課表 7 天 × 15 節；點課程 → 課程資訊彈窗 → 退選；hover 顯示 `-N`
- 頂端：模式、倒數、學分（上／下限）、登出提醒
- 進入時「重要提醒」彈窗；倒數結束自動登出
- RWD：手機版上下排列、課表可橫向捲動；手機上點一下先標示節次再開彈窗
- 風格：Naive UI `themeOverrides`、圓角卡片、課程類別彩色標籤、加選成功小動畫、深色模式

---

## 6. 階段

| 階段 | 內容                                                                                                       | 完成標準                   |
| ---- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| 0    | monorepo（npm workspaces）、ESLint、env 模式、正式機防呆、Express health、Vite 骨架、測試機連線、LDAP 測試 | 本機能查到學籍             |
| 1    | 驗證碼、登入（含代登）、JWT、單一登入、登出紀錄                                                            | 能登入、能踢舊登入         |
| 2    | SelectionContextService                                                                                    | 與舊系統同學號結果一致     |
| 3    | 課程查詢、課程資訊 API                                                                                     | 與舊系統一致               |
| 4    | 規則引擎 + 單元測試 + applock（測試機）                                                                    | 測試全過、壓測不超收不衝堂 |
| 5    | 前端畫面                                                                                                   | 操作一致、RWD              |
| 6    | 新舊並行比對（測試機）                                                                                     | 差異為 0 或已說明          |
| 7    | PM2 + IIS ARR 部署、壓測、切換                                                                             | 上線                       |
