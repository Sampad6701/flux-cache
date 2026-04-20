import { cache } from "fluxcache";

const fn = async (x) => {
  console.log("executing...");
  return x * 2;
};

const cached = cache(fn);

// Make some calls
await cached(2);
await cached(2);
await cached(3);

// Now check stats
console.log(cached.stats());