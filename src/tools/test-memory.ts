import { saveMemory, getMemory } from "./memory.ts";

await saveMemory(
  "preferred_language",
  "TypeScript",
);

const value = await getMemory("preferred_language");

console.log(value);
