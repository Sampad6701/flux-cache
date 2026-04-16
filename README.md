# flux cache

![npm](https://img.shields.io/npm/v/fluxcache)
![bundle size](https://img.shields.io/bundlephobia/minzip/fluxcache)

Zero-config async caching with automatic promise deduplication, stale-while-revalidate, and built-in observability.

**1.2KB gzipped. Zero dependencies. Framework-agnostic.**

## The Problem

Without caching, parallel calls to the same function execute redundantly:

```js
// Three identical calls = three executions
const user1 = await fetchUser(42);
const user2 = await fetchUser(42);
const user3 = await fetchUser(42);
```

flux cache collapses these into one:

```js
const cached = cache(fetchUser);
const user1 = await cached(42);
const user2 = await cached(42);  // Reuses same Promise
const user3 = await cached(42);  // Reuses same Promise
```

## Install

```bash
npm install fluxcache
```

## Why flux cache?

- **Zero configuration** — Drop in a single line, works immediately
- **Automatic deduplication** — Concurrent requests for the same data reuse the same Promise
- **Stale-while-revalidate** — Returns cached data instantly while refreshing in the background
- **Built-in observability** — Track hits, misses, hitRate, and revalidations with `stats()`
- **Deep key generation** — Handles complex arguments: objects, nested data, circular references
- **Lightweight** — 1.2KB gzipped, no external dependencies

## Usage

```js
import { cache } from "fluxcache";

const getUser = cache(
  async (id) => {
    const response = await fetch(`/api/users/${id}`);
    return response.json();
  },
  { ttl: 30_000 }
);

const a = getUser(42);
const b = getUser(42);

console.log(a === b); // true
```

## Stale-While-Revalidate

Returns cached data instantly while refreshing in the background—perfect for dynamic data.

```js
const getData = cache(
  async () => fetch("/api/data").then(r => r.json()),
  { ttl: 30_000, swr: true }  // swr is default
);

// First call
const data1 = await getData();

// At 31 seconds: returns stale data immediately, revalidates in background
const data2 = await getData();

// Backend call happens silently, next call gets fresh data
```

## Features

- **Deduplicates concurrent async calls** — Multiple requests for the same data reuse the same Promise
- **Stale-while-revalidate (SWR)** — Background revalidation for instant responses with fresh data
- **Cache statistics** — Built-in tracking: hits, misses, hitRate, size, revalidations
- Works with sync and async functions
- Deep stable key generation with automatic object normalization
- TTL-based expiration (milliseconds)
- Errors and rejections are never cached
- Custom key generation support
- Manual cleanup with `clear()` and `delete()`
- Handles circular references and complex objects safely
- Automatic probabilistic cleanup for long-running processes

## API

```js
const cached = cache(fn, options);
```

Options:

- `ttl` - Cache lifetime in ms. Default: `Infinity`
- `key` - Custom key generator. Default: POJO/array deep stable serialization
- `swr` - Enable stale-while-revalidate background revalidation. Default: `true`
- `onHit` - Called when cached value is reused
- `onMiss` - Called when fn executes

Methods:

- `cached.clear()` - Remove all entries
- `cached.delete(...args)` - Remove single entry by arguments
- `cached.stats()` - Get cache statistics (hits, misses, hitRate, size, etc.)
- `cached.resetStats()` - Reset all statistics counters

## Examples

Sync memoization:

```js
const square = cache((n) => n * n);
square(5); // 25
square(5); // cache hit
```

Custom key:

```js
const findUser = cache(
  (user) => user.name,
  { key: (user) => user.id }
);
```

Real-world custom key example:

```js
// Without custom key, [POST /users?filter=active], [GET /users?filter=active]
// would be different cache entries even though they're semantically similar
const fetchUsers = cache(
  async (endpoint, query) => {
    const res = await fetch(`${endpoint}?${new URLSearchParams(query)}`);
    return res.json();
  },
  {
    // Normalize query params to consistent key
    key: (endpoint, query) => `${endpoint}:${JSON.stringify(query)}`
  }
);
```

Hooks:

```js
const read = cache(expensiveOp, {
  onHit: (key) => console.log("reused:", key),
  onMiss: (key) => console.log("executed:", key)
});
```

Cache statistics:

```js
const fn = cache(slowFn, { ttl: 60_000 });

// Use cache...
fn(1);
fn(1);
fn(2);
fn(1);

const stats = fn.stats();
console.log(stats);
// {
//   hits: 2,
//   misses: 2,
//   total: 4,
//   hitRate: 0.5,
//   size: 2,
//   valueHits: 2,
//   promiseHits: 0,
//   revalidations: 0
// }

fn.resetStats();  // Clear counters, keep cache
```

## Notes

**Key Serialization**

Default key function uses deep stable serialization that automatically normalizes object keys and handles circular references:

- `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce the *same* cache key (keys are sorted)
- Circular objects are safely detected and tagged with unique identifiers
- For non-serializable arguments (custom class instances, functions), provide a custom `key` function

**TTL and Stale-While-Revalidate**

- `ttl: Infinity` (default) — Cache never expires unless manually cleared
- `ttl: 0` — Deduplicates concurrent calls but doesn't persist results; expires immediately
- `swr: true` (default) — Returns stale value while revalidating in the background
- `swr: false` — Traditional cache behavior; waits for revalidation before returning
- Expired entries are removed lazily on next access; automatic cleanup runs every 100 cache operations

**Statistics**

- Use `cached.stats()` to monitor cache health: hits, misses, hitRate, size, revalidations
- Separate tracking for `valueHits` (sync cached values) and `promiseHits` (concurrent async calls)
- Call `cached.resetStats()` to clear statistics without clearing the cache

**Memory Management**

For long-running processes with many unique keys, consider:

- Using finite TTLs to allow automatic cleanup
- Periodically calling `cached.clear()` to reset the cache
- Using a custom `key` function to normalize arguments and reduce cache entropy
- Disabling SWR with `{ swr: false }` if background revalidation is not needed
