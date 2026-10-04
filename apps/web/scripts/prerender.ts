import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Config, Data, Effect } from "effect";
import { landingDocument } from "../src/landing.js";

class RenderError extends Data.TaggedError("RenderError")<{ readonly message: string }> {}
const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const url = yield* Config.url("PUBLIC_SITE_URL").pipe(Config.withDefault(new URL("http://localhost:5177")));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    return yield* Effect.fail(new RenderError({ message: "PUBLIC_SITE_URL must be an HTTP(S) origin." }));
  const origin = url.origin;
  const names = yield* fs.readDirectory("dist/assets");
  const css = names.find((name) => name.endsWith(".css"));
  if (!css) return yield* Effect.fail(new RenderError({ message: "The asset build did not produce CSS." }));
  const document = yield* Effect.try({ try: () => landingDocument(origin, `/assets/${css}`), catch: () => new RenderError({ message: "Landing page rendering failed." }) });
  yield* fs.writeFileString("dist/index.html", document);
  yield* fs.writeFileString("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
  yield* fs.writeFileString("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`);
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeContext.layer)));
