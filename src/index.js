const DEFAULT_TTL = Infinity;

function defaultKey(...args) {
  return JSON.stringify(args);
}

function isPromiseLike(value) {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof value.then === "function"
  );
}

function getExpiresAt(ttl) {
  return ttl === Infinity ? Infinity : Date.now() + ttl;
}

export function cache(fn, options = {}) {
  if (typeof fn !== "function") {
    throw new TypeError("snapcache: expected fn to be a function");
  }

  const { ttl = DEFAULT_TTL, key = defaultKey, onHit, onMiss } = options;
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

  function cached(...args) {
    const cacheKey = key.apply(this, args);
    const entry = store.get(cacheKey);

    if (entry) {
      if (entry.promise) {
        onHit?.(cacheKey);
        return entry.promise;
      }

      if (entry.expiresAt === Infinity || entry.expiresAt > Date.now()) {
        onHit?.(cacheKey);
        return entry.value;
      }

      store.delete(cacheKey);
    }

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
    return store.delete(key.apply(this, args));
  };

  return cached;
}

export default cache;