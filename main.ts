import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setFlagsFromString } from "node:v8";

setFlagsFromString("--no-incremental-marking");

type Case = {
  id: unknown;
  input: unknown;
};

const { run } = (await import(new URL("./solve.js", import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const cases = JSON.parse(
  readFileSync(join(inputDir, "cases.json"), "utf8"),
) as Case[];

const answers: unknown[] = [];
for (const item of cases) {
  const result = run(item.input);
  answers.push(result instanceof Promise ? await result : result);
}

writeFileSync(join(outputDir, "answers.json"), JSON.stringify(answers));
