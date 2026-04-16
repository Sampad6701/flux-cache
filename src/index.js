const DEFAULT_TTL = Infinity;

function stableStringify(value) {
  const seen = new WeakSet();
  const circularIds = new WeakMap();
  let circularCount = 0;
  
  function stringify(val) {
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) {
        if (!circularIds.has(val)) {
          circularIds.set(val, circularCount++);
        }
        return "[Circular:" + circularIds.get(val) + "]";
      }
      seen.add(val);
      
      if (Array.isArray(val)) {
        return "[" + val.map(stringify).join(",") + "]";
      }
      
      const keys = Object.keys(val).sort();
      const pairs = keys.map(k => JSON.stringify(k) + ":" + stringify(val[k]));
      return "{" + pairs.join(",") + "}";
    }
    
    return JSON.stringify(val);
  }
  
  return stringify(value);
}

function defaultKey(...args) {
  return stableStringify(args);
}

function isPromiseLike(value) {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function"
  );
}

function getExpiresAt(ttl, now = Date.now()) {
  return ttl === Infinity ? Infinity : now + ttl;
}

export function cache(fn, options = {}) {
  if (typeof fn !== "function") {
    throw new TypeError("snapcache: expected fn to be a function");
  }

  const { ttl = DEFAULT_TTL, key = defaultKey, onHit, onMiss, swr = true } = options;
  const ttlMs = ttl == null ? DEFAULT_TTL : Number(ttl);

  if (!(ttlMs >= 0 || ttlMs === Infinity)) {
    throw new TypeError("snapcache: expected ttl to be a non-negative number");
  }

  if (typeof key !== "function") {
    throw new TypeError("snapcache: expected key to be a function");
  }

  if (onHit != null && typeof onHit !== "function") {
    throw new TypeError("snapcache: expected onHit to be a function");
  }

  if (onMiss != null && typeof onMiss !== "function") {
    throw new TypeError("snapcache: expected onMiss to be a function");
  }

  const store = new Map();
  let stats = { valueHits: 0, promiseHits: 0, misses: 0, revalidations: 0 };
  let opCount = 0;

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt !== Infinity && entry.expiresAt <= now) {
        store.delete(key);
      }
    }
  }

  function cached(...args) {
    opCount++;
    if (opCount % 100 === 0) cleanup();
    let cacheKey;
    try {
      cacheKey = key.apply(this, args);
    } catch (error) {
      stats.misses++;
      onMiss?.(undefined);
      return fn.apply(this, args);
    }

    const now = Date.now();
    const entry = store.get(cacheKey);

    // Case 1: Entry exists and is fresh (not expired)
    if (entry) {
      const isExpired = entry.expiresAt !== Infinity && entry.expiresAt <= now;
      
      if (!isExpired) {
        if (entry.promise) {
          stats.promiseHits++;
          onHit?.(cacheKey);
          return entry.promise;
        }

        stats.valueHits++;
        onHit?.(cacheKey);
        return entry.value;
      }

      // Case 2: Entry expired with stale value → stale-while-revalidate (if enabled)
      if (swr && entry.value !== undefined && !entry.promise) {
        const result = fn.apply(this, args);
        
        if (isPromiseLike(result)) {
          // Async: return stale immediately, revalidate in background
          stats.valueHits++;
          stats.revalidations++;
          onHit?.(cacheKey);
          
          const pending = Promise.resolve(result).then(
            (value) => {
              if (store.get(cacheKey) === entry) {
                entry.promise = null;
                entry.value = value;
                entry.expiresAt = getExpiresAt(ttlMs);
              }
              return value;
            },
            (error) => {
              if (store.get(cacheKey) === entry) {
                entry.promise = null;
              }
              throw error;
            }
          );
          entry.promise = pending;
          return entry.value;
        } else {
          // Sync: update immediately (no stale-while-revalidate for sync)
          stats.misses++;
          onMiss?.(cacheKey);
          
          if (ttlMs > 0) {
            entry.value = result;
            entry.expiresAt = getExpiresAt(ttlMs, now);
          } else {
            store.delete(cacheKey);
          }
          return result;
        }
      }

      // Case 3: Entry expired with no stale value → treat as miss
      store.delete(cacheKey);
    }

    // Case 4: MISS - no entry or no stale value available
    stats.misses++;
    onMiss?.(cacheKey);

    const result = fn.apply(this, args);

    if (!isPromiseLike(result)) {
      if (ttlMs > 0) {
        store.set(cacheKey, {
          value: result,
          expiresAt: getExpiresAt(ttlMs)
        });
      }

      return result;
    }

    const pendingEntry = {
      promise: null,
      value: undefined,
      expiresAt: Infinity
    };

    const pending = Promise.resolve(result).then(
      (value) => {
        if (store.get(cacheKey) === pendingEntry) {
          if (ttlMs > 0) {
            pendingEntry.promise = null;
            pendingEntry.value = value;
            pendingEntry.expiresAt = getExpiresAt(ttlMs);
          } else {
            store.delete(cacheKey);
          }
        }

        return value;
      },
      (error) => {
        if (store.get(cacheKey) === pendingEntry) {
          store.delete(cacheKey);
        }

        throw error;
      }
    );

    pendingEntry.promise = pending;
    store.set(cacheKey, pendingEntry);

    return pending;
  }

  cached.clear = function clear() {
    store.clear();
  };

  cached.delete = function remove(...args) {
    let cacheKey;
    try {
      cacheKey = key.apply(this, args);
    } catch (error) {
      return false;
    }
    return store.delete(cacheKey);
  };

  cached.stats = function getStats() {
    const hits = stats.valueHits + stats.promiseHits;
    const total = hits + stats.misses;
    return {
      hits,
      valueHits: stats.valueHits,
      promiseHits: stats.promiseHits,
      misses: stats.misses,
      total,
      hitRate: total === 0 ? 0 : Math.round((hits / total) * 10000) / 10000,
      size: store.size,
      revalidations: stats.revalidations
    };
  };

  cached.resetStats = function reset() {
    stats.revalidations = 0;
    stats.valueHits = 0;
    stats.promiseHits = 0;
    stats.misses = 0;
  };

  return cached;
}

export default cache;