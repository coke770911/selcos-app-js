// PM2 設定：pm2 start deploy/ecosystem.config.cjs
// 使用記憶體快取時只能跑單一 instance（fork）；改用 Redis/Garnet 後才可改 cluster
// 模式與所有參數統一由 server/.env 決定（NODE_ENV=production），這裡不另外設定
module.exports = {
  apps: [
    {
      name: 'selcos-api',
      cwd: __dirname + '/../server',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '1G',
      time: true,
    },
  ],
};
