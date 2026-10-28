import { lookup } from 'node:dns/promises';

/** 正式機資料庫：非 production 模式一律禁止連線 */
export const PROD_DB_HOSTS = ['172.16.29.1'];

/** 取出主機名稱，去掉 port 與 instance（例如 host,1433、host:1433、host\SQLEXPRESS） */
function hostName(host: string): string {
  return (
    host
      .trim()
      .toLowerCase()
      .split(/[\\,:]/)[0] ?? ''
  );
}

export function isProdDbHost(host: string): boolean {
  return PROD_DB_HOSTS.includes(hostName(host));
}

/** 非 production 模式指向正式機時丟出錯誤，讓程式無法啟動 */
export function assertDbHostAllowed(nodeEnv: string, host: string): void {
  if (nodeEnv !== 'production' && isProdDbHost(host)) {
    throw new Error(`[DB 防呆] NODE_ENV=${nodeEnv} 不可連線正式機資料庫 ${host}，請改用測試機。`);
  }
}

type LookupFn = (name: string) => Promise<{ address: string }[]>;
const defaultLookup: LookupFn = (name) => lookup(name, { all: true });

/**
 * 連線前檢查：除了字面比對，也解析網域名稱，避免用 DNS 名稱繞過防呆。
 * 解析失敗時不擋（連線本身也會失敗）。
 */
export async function assertDbTargetAllowed(
  nodeEnv: string,
  host: string,
  resolve: LookupFn = defaultLookup,
): Promise<void> {
  assertDbHostAllowed(nodeEnv, host);
  if (nodeEnv === 'production') return;

  let addresses: { address: string }[];
  try {
    addresses = await resolve(hostName(host));
  } catch {
    return;
  }
  const hit = addresses.find((a) => isProdDbHost(a.address));
  if (hit) {
    throw new Error(
      `[DB 防呆] NODE_ENV=${nodeEnv} 的 ${host} 解析為正式機 ${hit.address}，請改用測試機。`,
    );
  }
}
