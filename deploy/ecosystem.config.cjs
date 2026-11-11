// PM2 設定：pm2 start deploy/ecosystem.config.cjs
// 共用狀態（登入、驗證碼、選課前置資料）存在 SQL Server 快取（CACHE_DRIVER=sqlserver），可跑 cluster 多程序；
// CACHE_DRIVER=memory 時只能改回 exec_mode: 'fork'、instances: 1
// 資料庫總連線數 = 伺服器台數 × instances × DB_POOL_MAX（server/.env，預設 30）
// 模式與所有參數統一由 server/.env 決定（NODE_ENV=production），這裡不另外設定
module.exports = {
  apps: [
    {
      name: 'selcos-api',
      cwd: __dirname + '/../server',
      script: 'src/index.js',
      exec_mode: 'cluster',
      // 依伺服器核心數調整（建議核心數 − 1，最多 4），並配合 DB 連線預算
      instances: 4,
      autorestart: true,
      max_memory_restart: '1G',
      time: true,
      // pm2 reload 逐一重啟：Windows 收不到 SIGINT，改用訊息通知程式結束；等進行中的請求完成
      shutdown_with_message: true,
      kill_timeout: 10_000,
    },
  ],
};
