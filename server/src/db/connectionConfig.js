import tedious from 'tedious';

/**
 * @import { Options } from 'sequelize'
 * @import { Env } from '../config/env.js'
 */

/**
 * Sequelize（dialect mssql，驅動 tedious）連線設定，API 與檢查腳本共用
 * @param {Pick<Env, 'DB_HOST' | 'DB_PORT' | 'DB_NAME' | 'DB_USER' | 'DB_PASS' | 'DB_ENCRYPT' | 'DB_TRUST_SERVER_CERT' | 'DB_POOL_MAX'>} env
 * @returns {Options}
 */
export function buildSequelizeOptions(env) {
  return {
    dialect: 'mssql',
    dialectModule: tedious,
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASS,
    dialectOptions: {
      options: {
        encrypt: env.DB_ENCRYPT,
        trustServerCertificate: env.DB_TRUST_SERVER_CERT,
        // 資料庫的 datetime 存台灣本地時間，不當成 UTC 解讀
        useUTC: false,
        // 單一查詢最長執行時間（tedious 預設值，明確寫出）
        requestTimeout: 15_000,
      },
    },
    // 尖峰時保留幾條連線免得重新 TLS 握手；取不到連線 10 秒就放棄（回 503），不讓請求一直排隊
    pool: { max: env.DB_POOL_MAX, min: 5, acquire: 10_000, idle: 30_000 },
    // 不輸出每一句 SQL（錯誤會由呼叫端記錄）
    logging: false,
  };
}
