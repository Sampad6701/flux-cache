# fluxcache

![npm](https://img.shields.io/npm/v/fluxcache)
![bundle size](https://img.shields.io/bundlephobia/minzip/fluxcache)

**Stop duplicate async calls. Add TTL + stale-while-revalidate caching in ~1.2KB.**

`fluxcache` wraps any function and gives it Promise deduplication, TTL caching, stale-while-revalidate, stable argument keys, and built-in stats. Zero deps. Node and browser. Framework-agnostic.

```bash
npm install fluxcache
```

```js
import { cache } from "fluxcache";

const getUser = cache(fetchUser, { ttl: 30_000 });
```

## Before / After

Without `fluxcache`, three identical in-flight calls usually mean three network requests:

```js
const a = fetchUser(42);
const b = fetchUser(42);
const c = fetchUser(42);

await Promise.all([a, b, c]); // fetchUser ran 3 times
```

With `fluxcache`, concurrent calls with the same arguments share one Promise:

```js
import { cache } from "fluxcache";

const getUser = cache(fetchUser, { ttl: 30_000 });

const a = getUser(42);
const b = getUser(42);
const c = getUser(42);

await Promise.all([a, b, c]); // fetchUser ran once
```

After the Promise resolves, the value stays cached until its TTL expires. If SWR is enabled, expired values can be returned instantly while a refresh happens in the background.

## Why This Exists

Small apps and libraries often need caching before they need a full data-fetching framework.

You may have:

- Multiple callers requesting the same async result at the same time
- Expensive functions that should not rerun for every identical input
- API responses that can be reused briefly
- Dynamic data where stale data is better than waiting
- A need to see basic cache health without wiring observability yourself

`fluxcache` is the tiny layer for that job: cache any function, dedupe in-flight work, keep values fresh enough, and move on.

It is **not** a replacement for React Query, SWR, Apollo, Relay, or a full client-side data layer. Use those when you need UI-aware fetching, retries, mutations, invalidation graphs, persistence, pagination, or cache synchronization. Use `fluxcache` when you want to cache any sync or async function in any JavaScript environment.

## Install

```bash
npm install fluxcache
```

## Quick Start

```js
import { cache } from "fluxcache";

async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error("Failed to load user");
  return response.json();
}

const getUser = cache(fetchUser, {
  ttl: 60_000,
  swr: true
});

const user = await getUser("u_123");
```

The returned function has the same call signature as the original function, plus cache helpers:

```js
getUser.clear();
getUser.delete("u_123");
getUser.stats();
getUser.resetStats();
```

## Real-World Examples

### API Fetch

```js
import { cache } from "fluxcache";

export const getRepo = cache(
  async (owner, repo) => {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    if (!response.ok) throw new Error("GitHub request failed");
    return response.json();
  },
  {
    ttl: 5 * 60_000,
    swr: true
  }
);

const repo = await getRepo("Sampad6701", "flux-cache");
```

### Next.js / Node Route Handler

Cache expensive work at module scope so requests can reuse it while the process is alive:

```js
import { cache } from "fluxcache";

const getProfile = cache(
  async (userId) => {
    const response = await fetch(`https://api.example.com/users/${userId}`);
    if (!response.ok) throw new Error("Profile request failed");
    return response.json();
  },
  { ttl: 30_000, swr: true }
);

export async function GET(request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  const profile = await getProfile(userId);

  return Response.json(profile);
}
```

### Custom Key

The default key generator deeply serializes arguments with stable object key ordering. Use `key` when only part of the input should affect caching, or when you want to normalize arguments yourself.

```js
import { cache } from "fluxcache";

const searchUsers = cache(
  async ({ orgId, query, page = 1 }) => {
    const params = new URLSearchParams({ q: query, page });
    const response = await fetch(`/api/orgs/${orgId}/users?${params}`);
    return response.json();
  },
  {
    ttl: 10_000,
    key: ({ orgId, query, page = 1 }) =>
      `${orgId}:${query.trim().toLowerCase()}:${page}`
  }
);
```

### Stats

```js
import { cache } from "fluxcache";

const readConfig = cache(loadConfig, { ttl: 60_000 });

await readConfig("app");
await readConfig("app");
await readConfig("admin");

console.log(readConfig.stats());
```

Example shape:

```js
{
  hits: 1,
  valueHits: 1,
  promiseHits: 0,
  misses: 2,
  total: 3,
  hitRate: 0.3333,
  size: 2,
  revalidations: 0
}
```

## API Reference

### `cache(fn, options?)`

Wraps `fn` and returns a cached function.

```js
import { cache } from "fluxcache";

const cached = cache(fn, options);
```

`fn` must be a function. It can return a value or a Promise. Rejected Promises and thrown errors are not cached.

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `ttl` | `number` | `Infinity` | Cache lifetime in milliseconds. Must be non-negative. |
| `swr` | `boolean` | `true` | Return stale async values immediately after TTL expiry while refreshing in the background. |
| `key` | `(...args) => string` | stable deep key | Custom cache key generator. |
| `onHit` | `(key) => void` | `undefined` | Called when a cached value or in-flight Promise is reused. |
| `onMiss` | `(key) => void` | `undefined` | Called when the original function executes. |

### Methods

The cached function includes these methods:

| Method | Description |
| --- | --- |
| `clear()` | Remove all entries from this cache. |
| `delete(...args)` | Remove one entry using the same arguments passed to the cached function. Returns `true` if an entry was removed. |
| `stats()` | Return cache statistics: `hits`, `misses`, `hitRate`, `size`, `revalidations`, and more. |
| `resetStats()` | Reset counters while keeping cached entries. |

## TTL and SWR Behavior

### Fresh Values

If a cached entry exists and its TTL has not expired, `fluxcache` returns it immediately.

```js
const getPost = cache(fetchPost, { ttl: 30_000 });

await getPost(1); // miss
await getPost(1); // hit
```

### Concurrent Promises

If the original function returns a Promise, concurrent calls with the same key reuse the same in-flight Promise.

```js
const getPost = cache(fetchPost);

const a = getPost(1);
const b = getPost(1);

console.log(a === b); // true
```

### Stale-While-Revalidate

With `swr: true`, expired async values are returned immediately while `fluxcache` refreshes them in the background.

```js
const getFeed = cache(fetchFeed, {
  ttl: 15_000,
  swr: true
});

await getFeed(); // miss, fetches fresh data

// After 15 seconds:
await getFeed(); // returns stale value immediately, refreshes in background
```

When the background refresh resolves, the cache stores the fresh value for the next call. If the refresh rejects, the stale value remains available for a later attempt.

With `swr: false`, expired entries behave like normal misses: the stale entry is removed and the caller waits for the function to run again.

### TTL Values

- `ttl: Infinity` is the default. Entries do not expire unless removed manually.
- `ttl: 0` deduplicates in-flight async calls but does not persist resolved values.
- Finite TTLs are in milliseconds.

## Keys

By default, keys are generated from all arguments using deep stable serialization.

```js
cached({ a: 1, b: 2 });
cached({ b: 2, a: 1 }); // same key
```

Nested objects are supported, and circular references are handled safely. For class instances, functions, large objects, or domain-specific equality, provide a custom `key`.

## Memory and Cleanup

Each cached wrapper owns an internal `Map`. Entries stay there until one of these happens:

- The entry expires and is cleaned up lazily on access
- Automatic cleanup runs after cache operations
- You call `delete(...args)`
- You call `clear()`

For long-running processes with many unique keys:

- Prefer finite `ttl` values
- Normalize high-cardinality inputs with `key`
- Clear caches during lifecycle events when appropriate
- Avoid caching unbounded user-specific inputs unless that is intentional

## Small on Purpose

`fluxcache` is for caching function results, not managing application data.

Reach for `fluxcache` when you want:

- One-line async deduplication
- TTL and SWR around any function
- Stable keys for object arguments
- Cache stats without a framework
- A tiny, dependency-free package

Reach for a larger data-fetching library when your UI needs query invalidation, mutations, retries, request cancellation, pagination, persistence, or cross-component cache orchestration.
