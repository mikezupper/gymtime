import { Context, Effect, Schema } from "effect";
import { ApiFailure, CodeAccepted, Session, type AuthAction, type AuthResult } from "../domain/api.js";
import { newKey } from "./retry-keys.js";
import { Account, Accounts, type AccountAction } from "../domain/api.js";

export interface HttpCall { readonly method: "GET" | "POST" | "PATCH" | "DELETE"; readonly body?: unknown; readonly csrf?: string; readonly key?: string }
export class ApiClient extends Context.Tag("gymtime/ApiClient")<ApiClient, {
  readonly request: <A, I>(path: string, schema: Schema.Schema<A, I>, options: HttpCall) => Effect.Effect<A, ApiFailure>;
}>() {}
export const authenticate = (action: AuthAction): Effect.Effect<AuthResult, ApiFailure, ApiClient> => Effect.gen(function* () {
  const client = yield* ApiClient;
  switch (action.type) {
    case "request": {
      const value = yield* client.request("/api/v1/auth/request-code", CodeAccepted, { method: "POST", body: { email: action.email } });
      return { type: "accepted", message: value.message };
    }
    case "verify": return { type: "session", session: yield* client.request("/api/v1/auth/verify-code", Session, { method: "POST", body: { email: action.email, code: action.code } }) };
    case "session": return { type: "session", session: yield* client.request("/api/v1/auth/session", Session, { method: "GET" }) };
    case "logout": {
      yield* client.request("/api/v1/auth/logout", Schema.Struct({}), { method: "POST", csrf: action.csrf });
      return { type: "logged-out" };
    }
  }
});
export const manageAccounts = (action: AccountAction) => Effect.gen(function* () {
  const client = yield* ApiClient;
  switch (action.type) {
    case "list": break;
    case "invite": yield* client.request("/api/v1/accounts", Account, { method: "POST", body: { email: action.email, role: action.role }, csrf: action.csrf, key: yield* newKey }); break;
    case "status": yield* client.request(`/api/v1/accounts/${action.userId}`, Schema.Struct({}), { method: "PATCH", body: { enabled: action.enabled }, csrf: action.csrf, key: yield* newKey }); break;
  }
  return yield* client.request("/api/v1/accounts", Accounts, { method: "GET" });
});
