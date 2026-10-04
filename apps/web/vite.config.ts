import { defineConfig, type ViteDevServer } from "vite";
import { Config, Effect } from "effect";
import { landingDocument } from "./src/landing.js";

export default defineConfig(() => Effect.runPromise(Effect.gen(function* () {
  const webPort = yield* Config.integer("DEV_WEB_PORT").pipe(Config.withDefault(5177));
  const apiPort = yield* Config.integer("DEV_API_PORT").pipe(Config.withDefault(3017));
  return {
    server: { port: webPort, strictPort: true, proxy: { "/api": `http://127.0.0.1:${apiPort}`, "/health": `http://127.0.0.1:${apiPort}`, "/calendars": `http://127.0.0.1:${apiPort}` } },
    build: { target: "es2022", rollupOptions: { input: "shell.html" } },
    plugins: [{ name: "gymtime-documents", configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?").at(0);
        if (path === "/") {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(landingDocument(`http://localhost:${webPort}`, "/src/styles/global.css"));
        } else if (path === "/sign-in" || path === "/app" || path === "/app/calendar" || /^\/teams\/[^/]+$/.test(path ?? "")) {
          res.setHeader("X-Robots-Tag", "noindex"); req.url = "/shell.html"; next();
        } else { next(); }
      });
    } }],
  };
})));
