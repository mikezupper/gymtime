import { createServer } from "node:http";
import { HttpRouter, HttpServer, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Config, Effect, Layer, Ref, Schema } from "effect";

const Message = Schema.Struct({ from: Schema.String, to: Schema.Array(Schema.String), subject: Schema.String, text: Schema.String });
type Message = typeof Message.Type;
interface Captured { readonly id: string; readonly key: string; readonly message: Message }

const program = Effect.gen(function* () {
  const port = yield* Config.integer("DEV_EMAIL_PORT").pipe(Config.withDefault(8027));
  const host = yield* Config.string("EMAIL_SANDBOX_HOST").pipe(Config.withDefault("127.0.0.1"));
  const inbox = yield* Ref.make<ReadonlyArray<Captured>>([]);
  const router = HttpRouter.empty.pipe(
    HttpRouter.get("/health", HttpServerResponse.text("ready")),
    HttpRouter.get("/messages", Effect.flatMap(Ref.get(inbox), HttpServerResponse.json)),
    HttpRouter.post("/emails", Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.headers.authorization !== "Bearer local-test-key") return yield* HttpServerResponse.json({ name: "validation_error", statusCode: 401, message: "Use the local test key." }, { status: 401 });
      const message = yield* request.json.pipe(Effect.flatMap(Schema.decodeUnknown(Message)));
      const key = request.headers["idempotency-key"] ?? "";
      const result = yield* Ref.modify(inbox, (items) => {
        const prior = items.find((item) => key !== "" && item.key === key);
        if (prior) return [prior.id, items] as const;
        const id = `sandbox-${items.length + 1}`;
        return [id, [...items, { id, key, message }].slice(-100)] as const;
      });
      return yield* HttpServerResponse.json({ id: result });
    }).pipe(Effect.catchAll(() => HttpServerResponse.json({ name: "validation_error", statusCode: 400, message: "Invalid test email." }, { status: 400 })))),
  );
  const server = HttpServer.serve(router).pipe(Layer.provide(NodeHttpServer.layer(createServer, { port, host })));
  yield* Effect.log(`Local email sandbox: http://localhost:${port}/messages`);
  yield* Layer.launch(server);
});

NodeRuntime.runMain(program);
