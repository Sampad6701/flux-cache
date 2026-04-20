import { cache } from "fluxcache";

let counter = 0;

const fn = async () => {
  counter++;
  console.log("fetching...", counter);
  return counter;
};

const cached = cache(fn, { ttl: 1000 }); // 1s TTL

// First call
await cached(); // should fetch

// Wait for expiry
setTimeout(async () => {
  console.log("calling after ttl");

  const val1 = await cached(); // should return stale instantly
  console.log("returned:", val1);

  const val2 = await cached(); // should now be refreshed
  console.log("after refresh:", val2);
}, 1200);