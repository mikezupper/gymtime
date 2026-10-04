import { Data, Schema } from "effect";

export const Session = Schema.Struct({
  user_id: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.brand("UserId")),
  email: Schema.String,
  organizer: Schema.Boolean,
  csrf_token: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/)),
});
export type Session = typeof Session.Type;
export const Account = Schema.Struct({ user_id: Schema.Number.pipe(Schema.int(), Schema.positive()), email: Schema.String, organizer: Schema.Boolean, enabled: Schema.Boolean });
export const Accounts = Schema.Array(Account);
export type AccountAction = { readonly type: "list" } | { readonly type: "invite"; readonly email: string; readonly role: "organizer" | "coach"; readonly csrf: string } | { readonly type: "status"; readonly userId: number; readonly enabled: boolean; readonly csrf: string };
export const CodeAccepted = Schema.Struct({ message: Schema.String, resend_after_seconds: Schema.Number.pipe(Schema.int(), Schema.positive()) });
export const ErrorBody = Schema.Struct({ code: Schema.String, message: Schema.String, request_id: Schema.String, issues: Schema.Array(Schema.Struct({ field: Schema.String, message: Schema.String })) });
export class ApiFailure extends Data.TaggedError("ApiFailure")<{
  readonly code: string;
  readonly message: string;
  readonly issues: ReadonlyArray<{ readonly field: string; readonly message: string }>;
}> {}
export type AuthAction =
  | { readonly type: "request"; readonly email: string }
  | { readonly type: "verify"; readonly email: string; readonly code: string }
  | { readonly type: "session" }
  | { readonly type: "logout"; readonly csrf: string };
export type AuthResult =
  | { readonly type: "accepted"; readonly message: string }
  | { readonly type: "session"; readonly session: Session }
  | { readonly type: "logged-out" };
