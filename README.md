# 選課系統（selcos-app）

亞東科技大學選課系統重構版。舊系統（PHP）在 `D:\project\selcos`，規劃見 [PLAN.md](PLAN.md)。

> ⚠️ 正式機資料庫 `172.16.29.1` 開發期間禁止任何讀寫。非 production 模式指向正式機時，API 與 Prisma CLI 都會拒絕執行。

## 結構

| 目錄      | 說明                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| `shared/` | 前後端共用型別                                                                  |
| `server/` | Express 5 + TypeScript + Prisma（SQL Server）API                                |
| `web/`    | Vue 3 + Vite + Naive UI + UnoCSS 前端（打包輸出到 `server/public`，由後端提供） |
| `deploy/` | PM2 與 IIS ARR 設定                                                             |

## 環境模式

整個系統只有一個設定檔 `server/.env`（範本 `server/.env.example`），同一個檔案放正式與測試兩組參數，用 `NODE_ENV` 切換：

| 模式     | NODE_ENV      | 讀取的參數                         | 自動預設                          |
| -------- | ------------- | ---------------------------------- | --------------------------------- |
| 測試模式 | `development` | `TEST_DB_*`、`TEST_ADMIN_ACCOUNTS` | 標題 `[測試]`、選課 5 小時、debug |
| 正式模式 | `production`  | `DB_*`、`ADMIN_ACCOUNTS`           | 無後綴、選課 30 分鐘、info        |

測試模式不會退回使用正式參數，`TEST_DB_HOST` 沒填就無法啟動。

未設定 `NODE_ENV` 時預設為 `development`；已存在的系統環境變數不會被 `.env` 覆寫。前端沒有自己的 env 檔，標題等資訊由 `GET /api/public/app-info` 提供。

## 開發

```bash
npm install
cp server/.env.example server/.env   # 填入 TEST_DB_* 測試機帳密與 JWT_SECRET
npm run check:db -w server -- 學號    # 測試機連線與學籍查詢（只做 SELECT）
npm run check:ldap -w server -- 帳號  # AD 驗證
npm run check:cache -w server         # 共用快取（CACHE.tb_Session）讀寫檢查
npm run db:pull -w server             # 從測試機反向產生 Prisma schema
npm run db:generate -w server
npm run dev:server                    # http://localhost:3000/api/health
npm run dev:web                       # http://localhost:5173
```

其他指令：`npm run typecheck`、`npm run lint`、`npm run format`、`npm test`、`npm run build`。

## 部署（IIS ARR + PM2）

正式環境只有一個 port（3000）：前端打包進 `server/public`，由 Express 一起提供畫面與 API。

1. `npm run build`（後端編譯到 `server/dist`，前端打包到 `server/public`）
2. 正式主機放 `server/.env`（`NODE_ENV=production`）
3. `pm2 start deploy/ecosystem.config.cjs`
4. IIS 站台放入 `deploy/web.config`，把所有請求轉給 `localhost:3000`（需 URL Rewrite + ARR Proxy）

開發時可以用兩種方式：

- `npm run dev:server` + `npm run dev:web`：開 http://localhost:5173 ，改程式碼畫面即時更新（Vite 會把 `/api` 轉給 3000）
- `npm run build -w web` 後只開 `npm run dev:server`：開 http://localhost:3000 ，與正式環境相同的單一 port
