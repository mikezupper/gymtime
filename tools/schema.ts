import { Effect } from "effect";
import { assert, isMain, read, run, walk, write } from "./system.js";

export const schema = (check: boolean) => Effect.gen(function* () {
  const files = (yield* walk("migrations")).filter((file) => file.endsWith(".sql")).sort();
  const sections = yield* Effect.forEach(files, (file) => read(file).pipe(Effect.map((sql) => `## ${file}\n\n\`\`\`sql\n${sql.trim()}\n\`\`\`\n`)), { concurrency: 2 });
  const content = `# SQLite migration reference\n\nGenerated from ordered migration files by \`pnpm schema:generate\`. This records the applied schema changes; it is not a second schema definition. Read [Architecture](../ARCHITECTURE.md) for transaction ownership.\n\n${sections.join("\n")}`;
  if (check) yield* assert((yield* read("docs/schema.md")) === content, "Migration documentation drift: run pnpm schema:generate.");
  else yield* write("docs/schema.md", content);
  yield* Effect.log(`Migration documentation ${check ? "check" : "generation"} passed.`);
});
if (isMain(import.meta.url)) run(schema(process.argv.at(2) === "check"));
