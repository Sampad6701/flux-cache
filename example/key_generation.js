import { cache } from "fluxcache";

const fn = async (obj) => {
  console.log("executing...");
  return obj.a;
};

const cached = cache(fn);

await cached({ a: 1, b: 2 });
await cached({ b: 2, a: 1 }); // same structure, different order