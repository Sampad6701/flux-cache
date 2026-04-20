import { cache } from "fluxcache";

let executions = 0;

const fn = async (x) => {
  executions++;
  console.log("executing...", executions);

  // simulate async delay
  await new Promise((r) => setTimeout(r, 100));

  return x * 2;
};

const cached = cache(fn);

async function run() {
  console.log("Starting concurrent calls...\n");

  const results = await Promise.all([
    cached(5),
    cached(5),
    cached(5)
  ]);

  console.log("\nResults:", results);

  console.log("\nStats:", cached.stats());
}

run();