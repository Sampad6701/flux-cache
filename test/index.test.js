import test from "node:test";
import assert from "node:assert/strict";

import { cache } from "../src/index.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("caches sync results and fires hooks", () => {
  let calls = 0;
  const hits = [];
  const misses = [];
  const sum = cache(
    (a, b) => {
      calls += 1;
      return a + b;
    },
    {
      onHit: (key) => hits.push(key),
      onMiss: (key) => misses.push(key)
    }
  );

  assert.equal(sum(2, 3), 5);
  assert.equal(sum(2, 3), 5);
  assert.equal(calls, 1);
  assert.deepEqual(misses, ["[2,3]"]);
  assert.deepEqual(hits, ["[2,3]"]);
});

test("expires values after ttl", async () => {
  let calls = 0;
  const next = cache(
    () => {
      calls += 1;
      return calls;
    },
    { ttl: 20 }
  );

  assert.equal(next(), 1);
  assert.equal(next(), 1);

  await sleep(30);

  assert.equal(next(), 2);
});

test("deduplicates concurrent async calls and reuses resolved values", async () => {
  let calls = 0;
  const load = cache(
    async (id) => {
      calls += 1;
      await sleep(25);
      return { id, calls };
    },
    { ttl: 50 }
  );

  const [a, b, c] = await Promise.all([load(7), load(7), load(7)]);

  assert.equal(calls, 1);
  assert.strictEqual(a, b);
  assert.strictEqual(b, c);

  const cached = await load(7);

  assert.equal(calls, 1);
  assert.strictEqual(cached, a);
});

test("does not cache thrown errors or rejected promises", async () => {
  let syncCalls = 0;
  const crash = cache(() => {
    syncCalls += 1;
    throw new Error("boom");
  });

  assert.throws(() => crash(), /boom/);
  assert.throws(() => crash(), /boom/);
  assert.equal(syncCalls, 2);

  let asyncCalls = 0;
  const rejectLater = cache(async () => {
    asyncCalls += 1;
    await sleep(5);
    throw new Error("nope");
  });

  await assert.rejects(() => rejectLater(), /nope/);
  await assert.rejects(() => rejectLater(), /nope/);
  assert.equal(asyncCalls, 2);
});

test("supports custom keys and manual invalidation", () => {
  let calls = 0;
  const read = cache(
    (record) => {
      calls += 1;
      return { seen: calls, record };
    },
    {
      key: (record) => record.id
    }
  );

  const first = read({ id: "user-1", name: "Ada" });
  const second = read({ id: "user-1", name: "Grace" });

  assert.equal(calls, 1);
  assert.strictEqual(first, second);
  assert.equal(read.delete({ id: "user-1" }), true);

  const third = read({ id: "user-1", name: "Linus" });

  assert.equal(calls, 2);
  assert.notStrictEqual(third, second);

  read.clear();

  const fourth = read({ id: "user-1", name: "Ken" });

  assert.equal(calls, 3);
  assert.notStrictEqual(fourth, third);
});