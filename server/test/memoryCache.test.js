import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryCache } from '../src/cache/memoryCache.js';

let t = 0;
const cache = createMemoryCache(() => t);
afterEach(() => {
  t = 0;
});

describe('memoryCache', () => {
  it('過期後讀不到', async () => {
    await cache.set('a', 1, 10);
    expect(await cache.get('a')).toBe(1);
    t = 10_000;
    expect(await cache.get('a')).toBeUndefined();
  });

  it('take 取出後刪除', async () => {
    await cache.set('b', 'x', 10);
    expect(await cache.take('b')).toBe('x');
    expect(await cache.take('b')).toBeUndefined();
  });

  it('count 只算未過期的前綴', async () => {
    await cache.set('s:1', 1, 5);
    await cache.set('s:2', 1, 20);
    await cache.set('x:1', 1, 20);
    expect(await cache.count('s:')).toBe(2);
    t = 6_000;
    expect(await cache.count('s:')).toBe(1);
  });
});
