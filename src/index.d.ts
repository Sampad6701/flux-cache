export interface CacheOptions<T = any> {
  /**
   * Cache lifetime in milliseconds.
   * @default Infinity
   */
  ttl?: number;

  /**
   * Custom key generator function.
   * Receives function arguments and returns a string cache key.
   * Supports deep nested objects with stable key generation.
   * @default Uses stable stringify with recursive key sorting
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

  /**
   * Enable stale-while-revalidate for async functions.
   * When enabled, expired entries with stale values return immediately
   * while background revalidation occurs.
   * @default true
   */
  swr?: boolean;
}

export interface CacheStatistics {
  /**
   * Combined count of value hits and promise hits.
   */
  hits: number;

  /**
   * Number of times a cached value was reused directly.
   */
  valueHits: number;

  /**
   * Number of times an in-flight promise was reused (deduplication).
   */
  promiseHits: number;

  /**
   * Number of times the function executed (cache misses).
   */
  misses: number;

  /**
   * Total number of function calls (hits + misses).
   */
  total: number;

  /**
   * Cache hit rate as a decimal between 0 and 1.
   * Rounded to 4 decimal places.
   * Calculated as hits / (hits + misses).
   */
  hitRate: number;

  /**
   * Current number of entries in the cache.
   */
  size: number;

  /**
   * Number of background revalidations triggered by stale-while-revalidate.
   */
  revalidations: number;
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
  delete(...args: Parameters<T>): boolean;

  /**
   * Get cache statistics (hits, misses, total, hitRate, size).
   * Has near-zero overhead.
   */
  stats(): CacheStatistics;

  /**
   * Reset all statistics counters while preserving cached data.
   */
  resetStats(): void;
}

/**
 * Wraps a function with intelligent caching.
 *
 * Features:
 * - Deterministic memoization for sync and async functions
 * - Automatic deduplication of concurrent async calls
 * - TTL-based expiration with lazy cleanup
 * - Stale-while-revalidate for async functions (optional, enabled by default)
 * - Error-safe (errors and rejections are never cached)
 * - Detailed cache statistics and monitoring
 * - Deep stable key generation with circular reference handling
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
 * }, { ttl: 30000, swr: true });
 *
 * const user1 = await getUser(123);
 * const user2 = await getUser(123); // Reuses same Promise
 * const stats = getUser.stats(); // Detailed analytics
 */
export function cache<T extends (...args: any[]) => any>(
  fn: T,
  options?: CacheOptions
): CachedFunction<T>;

export default cache;