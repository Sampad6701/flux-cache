export interface CacheOptions<T = any> {
  /**
   * Cache lifetime in milliseconds.
   * @default Infinity
   */
  ttl?: number;

  /**
   * Custom key generator function.
   * Receives function arguments and returns a string cache key.
   * @default (...args) => JSON.stringify(args)
   */
  key?: (...args: any[]) => string;

  /**
   * Called when a cached value or in-flight promise is reused.
   */
  onHit?: (key: string) => void;

  /**
   * Called when the function must execute (cache miss).
   */
  onMiss?: (key: string) => void;
}

export interface CachedFunction<T extends (...args: any[]) => any> {
  /**
   * The wrapped cached function with identical signature to the original.
   */
  (...args: Parameters<T>): ReturnType<T>;

  /**
   * Remove all entries from the cache.
   */
  clear(): void;

  /**
   * Remove a specific cache entry by function arguments.
   */
  delete(...args: Parameters<T>): void;
}

/**
 * Wraps a function with intelligent caching.
 *
 * Features:
 * - Deterministic memoization for sync and async functions
 * - Automatic deduplication of concurrent async calls
 * - TTL-based expiration with lazy cleanup
 * - Error-safe (errors and rejections are never cached)
 *
 * @template T - The function type being cached
 * @param fn - The function to cache
 * @param options - Cache configuration
 * @returns Cached function with cache control methods
 *
 * @example
 * const getUser = cache(async (id: number) => {
 *   const res = await fetch(`/api/users/${id}`);
 *   return res.json();
 * }, { ttl: 30000 });
 *
 * const user1 = await getUser(123);
 * const user2 = await getUser(123); // Reuses same Promise
 */
export function cache<T extends (...args: any[]) => any>(
  fn: T,
  options?: CacheOptions
): CachedFunction<T>;

export default cache;
