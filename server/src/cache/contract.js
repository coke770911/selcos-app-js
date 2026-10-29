/** @import { CacheStore } from './CacheStore.js' */

/**
 * @typedef {object} ContractResult
 * @property {string} name
 * @property {boolean} ok
 * @property {string} [detail]
 */

/**
 * CacheStore 共用行為檢查：記憶體版在單元測試跑，SQL Server 版用 check:cache 對測試機跑。
 * 會用 prefix 開頭的 key，結束時自行清除。
 * @param {CacheStore} cache
 * @param {string} prefix
 * @param {(ms: number) => Promise<void>} sleep
 * @returns {Promise<ContractResult[]>}
 */
export async function runCacheContract(cache, prefix, sleep) {
  /** @type {ContractResult[]} */
  const results = [];
  /** @type {(name: string, ok: boolean, detail?: unknown) => number} */
  const check = (name, ok, detail) =>
    results.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  /** @param {string} s */
  const k = (s) => `${prefix}${s}`;

  await cache.set(k('obj'), { a: 1, s: '中文' }, 60);
  /** @type {{ a: number; s: string } | undefined} */
  const obj = await cache.get(k('obj'));
  check('set/get 物件', obj?.a === 1 && obj.s === '中文', obj);

  await cache.set(k('obj'), { a: 2, s: 'x' }, 60);
  check('set 覆寫', /** @type {{ a: number } | undefined} */ (await cache.get(k('obj')))?.a === 2);

  check('get 不存在', (await cache.get(k('none'))) === undefined);

  await cache.set(k('once'), 'v', 60);
  const [t1, t2] = await Promise.all([cache.take(k('once')), cache.take(k('once'))]);
  check('take 同時取只有一個成功', [t1, t2].filter((v) => v === 'v').length === 1, [t1, t2]);
  check('take 後讀不到', (await cache.get(k('once'))) === undefined);

  await cache.set(k('del'), 1, 60);
  await cache.del(k('del'));
  check('del', (await cache.get(k('del'))) === undefined);

  await cache.set(k('cnt:1'), 1, 60);
  await cache.set(k('cnt:2'), 1, 60);
  await cache.set(k('cnt:3'), 1, 1);
  check('count 前綴', (await cache.count(k('cnt:'))) === 3);

  await sleep(2100);
  check('過期後 get 讀不到', (await cache.get(k('cnt:3'))) === undefined);
  check('過期後 take 讀不到', (await cache.take(k('cnt:3'))) === undefined);
  check('過期後不計入 count', (await cache.count(k('cnt:'))) === 2);

  for (const s of ['obj', 'cnt:1', 'cnt:2', 'cnt:3']) await cache.del(k(s));
  return results;
}
