import { cache } from "fluxcache";

const square = cache((n) => {
  console.log("compute...");
  return n * n;
});

square(2);
square(2);