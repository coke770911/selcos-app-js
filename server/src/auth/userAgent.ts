/** 瀏覽器名稱（寫入登入紀錄 log_browser，沿用舊系統 BrowserDecide 的分類） */
export function browserName(ua: string | undefined): string {
  if (!ua) return 'Browser';
  if (ua.includes('Mobile')) return 'Mobile';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('rv:11.0')) return 'IE11';
  // log_browser 為 varchar(30)
  return ua.slice(0, 30);
}
