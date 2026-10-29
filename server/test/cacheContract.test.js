import { describe, expect, it } from 'vitest';
import { createMemoryCache } from '../src/cache/memoryCache.js';
import { runCacheContract } from '../src/cache/contract.js';

describe('CacheStore 共用行為（記憶體版）', () => {
  it('通過所有檢查', async () => {
    const results = await runCacheContract(
      createMemoryCache(),
      'test:',
      (ms) => new Promise((r) => setTimeout(r, ms)),
    );
    expect(results.filter((r) => !r.ok)).toEqual([]);
  }, 10_000);
});
