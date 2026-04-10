
# snapcache

Zero-config caching for any function. Eliminates duplicate API calls, deduplicates concurrent requests, and skips manual cache management.

**1.2KB gzipped. Zero dependencies. Framework-agnostic.**

## The Problem

Without caching, parallel calls to the same function execute redundantly:

```js
// Three identical calls = three executions
const user1 = await fetchUser(42);
const user2 = await fetchUser(42);
const user3 = await fetchUser(42);
```

snapcache collapses these into one:

```js
const cached = cache(fetchUser);
const user1 = await cached(42);
const user2 = await cached(42);  // Reuses same Promise
const user3 = await cached(42);  // Reuses same Promise
```

## Install

```bash
npm install snapcache
```

## Usage

```js
import { cache } from "snapcache";

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

## Features

- Works with sync and async functions
- Deduplicates concurrent async calls
- TTL-based expiration (milliseconds)
- Errors and rejections are never cached
- Custom key generation support
- Manual cleanup with `clear()` and `delete()`

## API

```js
const cached = cache(fn, options);
```

Options:

- `ttl` - Cache lifetime in ms. Default: `Infinity`
- `key` - Custom key generator. Default: `(...args) => JSON.stringify(args)`
- `onHit` - Called when cached value is reused
- `onMiss` - Called when fn executes

Methods:

- `cached.clear()` - Remove all entries
- `cached.delete(...args)` - Remove single entry by arguments

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

## Notes

**Key Serialization:**
- Default key function uses `JSON.stringify(args)`, which works for primitives, arrays, and plain objects
- For non-serializable arguments (class instances, functions, circular refs), provide a custom `key` function
- Object property order matters: `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` produce different keys

**TTL Behavior:**
- `ttl: Infinity` (default) — Cache never expires unless manually cleared
- `ttl: 0` — Deduplicates concurrent calls but doesn't persist results; expires immediately
- Expired entries are removed lazily on next access (no background timers)

**Memory Management:**
- For long-running processes with many unique keys, consider:
  - Using finite TTLs to allow automatic cleanup
  - Periodically calling `cached.clear()` to reset the cache
  - Using a custom `key` function to normalize arguments and reduce cache entropy
