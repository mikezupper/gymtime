import { Command, FetchHttpClient, FileSystem, HttpClient } from "@effect/platform";
import { Config, Effect, Schedule } from "effect";
import { assert, command, run, ToolError } from "./system.js";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(".local", { recursive: true });
  yield* command("cargo", ["build", "--locked", "-p", "gymtime-server"]);
  const apiPort = yield* Config.string("DEV_API_PORT").pipe(Config.withDefault("3017"));
  const webPort = yield* Config.string("DEV_WEB_PORT").pipe(Config.withDefault("5177"));
  const database = yield* Config.string("DEV_DATABASE_URL").pipe(Config.withDefault("sqlite://.local/gymtime.db"));
  const emailPort = yield* Config.string("DEV_EMAIL_PORT").pipe(Config.withDefault("8027"));
  const organizer = yield* Config.string("INITIAL_ORGANIZER_EMAIL").pipe(Config.withDefault("organizer@example.test"));
  const publicUrl = yield* Config.string("DEV_PUBLIC_URL").pipe(Config.withDefault(`http://localhost:${process.argv.at(2) === "api" ? apiPort : webPort}`));
  const start = (cmd: Command.Command) => Effect.acquireRelease(Command.start(cmd.pipe(Command.stdout("inherit"), Command.stderr("inherit"))),
    (process) => process.kill("SIGTERM").pipe(Effect.andThen(process.exitCode), Effect.timeout("12 seconds"),
      Effect.catchAll(() => process.kill("SIGKILL").pipe(Effect.catchAll(() => Effect.void)))));
  const email = yield* start(Command.make("node", "--import", "tsx", "tools/email-sandbox.ts").pipe(Command.env({ DEV_EMAIL_PORT: emailPort })));
  yield* HttpClient.get(`http://localhost:${emailPort}/health`).pipe(Effect.flatMap((response) => response.text),
    Effect.retry({ times: 50,schedule: Schedule.spaced("100 millis") }),Effect.timeout("10 seconds"),
    Effect.mapError(() => new ToolError({ operation: "development startup", detail: "The local email sandbox did not become ready." })),Effect.provide(FetchHttpClient.layer));
  const api = yield* start(Command.make("target/debug/gymtime-server").pipe(Command.env({
    APP_ENV: "development", APP_PORT: apiPort, DATABASE_URL: database, APP_PUBLIC_URL: publicUrl,
    RESEND_BASE_URL: `http://localhost:${emailPort}`, RESEND_API_KEY: "local-test-key", EMAIL_FROM: "gymtime@example.test", INITIAL_ORGANIZER_EMAIL: organizer,
  })));
  yield* Effect.log(`Gymtime API: http://localhost:${apiPort}`);
  if (process.argv.at(2) === "api") { yield* assert((yield* Effect.raceFirst(api.exitCode,email.exitCode)) === 0, "A development service exited unsuccessfully."); }
  else {
    const web = yield* start(Command.make("node", "node_modules/vite/bin/vite.js", "--host", "127.0.0.1").pipe(
      Command.workingDirectory("apps/web"), Command.env({ DEV_API_PORT: apiPort, DEV_WEB_PORT: webPort })));
    yield* Effect.log(`Gymtime web: http://localhost:${webPort}`);
    yield* assert((yield* Effect.raceFirst(api.exitCode, Effect.raceFirst(web.exitCode, email.exitCode))) === 0, "A development service exited unsuccessfully.");
  }
}).pipe(Effect.scoped);

run(program);
