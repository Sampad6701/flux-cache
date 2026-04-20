import { cache } from "fluxcache";

let attempt = 0;

const fn = async () => {
  attempt++;
  if (attempt < 2) {
    console.log("failing...");
    throw new Error("fail");
  }
  console.log("success");
  return 42;
};

const cached = cache(fn);

try {
  await cached();
} catch {}

await cached(); // should retry, NOT use cached error