import { cache } from "fluxcache";

const fn = async (x) => {
  console.log("executing...");
  return x * 2;
};

const cached = cache(fn);

await Promise.all([cached(2), cached(2)]);