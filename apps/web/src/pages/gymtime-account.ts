import { command, css, define, html, nothing } from "@gyral/core";
import { Either } from "effect";
import { ApiFailure, type Session } from "../domain/api.js";
import { authDriver, navigate, type Result } from "../runtime/commands.js";
import "./gymtime-connection.js";
import "./gymtime-planner.js";
interface State {
  readonly status: "Loading" | "Ready";
  readonly session: Session | undefined;
  readonly failure: ApiFailure | undefined;
  readonly signingOut: boolean;
}
type Msg =
  | { readonly _tag: "Loaded"; readonly result: Result<"auth"> }
  | { readonly _tag: "Logout" }
  | { readonly _tag: "LoggedOut"; readonly result: Result<"auth"> }
  | { readonly _tag: "Retry" }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure };
const load = () =>
  command(
    authDriver,
    { type: "session" },
    {
      key: "session",
      concurrency: "switch",
      onSuccess: (result): Msg => ({ _tag: "Loaded", result }),
      onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
    },
  );
export const GymtimeAccount = define<State, Msg>()("gymtime-account", {
  init: () => [
    {
      status: "Loading",
      session: undefined,
      failure: undefined,
      signingOut: false,
    },
    [load()],
  ],
  styles: css`
    :host {
      position: relative;
    }
    .account-bar {
      position: absolute;
      inset-block-start: -3.35rem;
      inset-inline-end: 0;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      font-size: 0.8rem;
    }
    .account-menu {
      position: relative;
    }
    summary {
      box-sizing: border-box;
      line-height: 1.4;
      cursor: pointer;
      min-block-size: 44px;
      display: flex;
      align-items: center;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
    }
    .menu-body {
      position: absolute;
      inset-inline-end: 0;
      z-index: 3;
      min-inline-size: 17rem;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 0.6rem;
      background: var(--surface-raised);
      box-shadow: 0 4px 16px oklch(0% 0 0 / 0.1);
    }
    .menu-body p {
      overflow-wrap: anywhere;
    }
    .connection {
      margin-block-start: 2rem;
      font-size: 0.85rem;
    }
    :host {
      display: block;
    }
    p {
      line-height: 1.65;
    }
    button {
      font: inherit;
      min-block-size: 44px;
      background: var(--surface-raised);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 0.65rem 1.2rem;
      border-radius: 0.5rem;
      cursor: pointer;
    }
    :focus-visible {
      outline: 3px solid var(--accent);
      outline-offset: 3px;
    }
  `,
  intent: { Logout: true, Retry: true },
  update: {
    Loaded: (s, m) => ({
      ...s,
      status: "Ready",
      session:
        Either.isRight(m.result) && m.result.right.type === "session"
          ? m.result.right.session
          : undefined,
      failure: Either.isLeft(m.result) ? m.result.left : undefined,
    }),
    Logout: (s) =>
      !s.session || s.signingOut
        ? s
        : [
            { ...s, signingOut: true, failure: undefined },
            [
              command(
                authDriver,
                { type: "logout", csrf: s.session.csrf_token },
                {
                  key: "logout",
                  concurrency: "exhaust",
                  onSuccess: (result): Msg => ({ _tag: "LoggedOut", result }),
                  onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
                },
              ),
            ],
          ],
    LoggedOut: (s, m) =>
      Either.isLeft(m.result)
        ? { ...s, signingOut: false, failure: m.result.left }
        : [
            { ...s, signingOut: false, session: undefined },
            [navigate("/sign-in")],
          ],
    Retry: (s) => [{ ...s, status: "Loading", failure: undefined }, [load()]],
    Failed: (s, m) => ({
      ...s,
      status: "Ready",
      signingOut: false,
      failure: m.failure,
    }),
  },
  view: (s, i) => {
    if (s.status === "Loading")
      return html`<p role="status">Checking your account…</p>`;
    const session = s.session;
    if (!session)
      return html`<h1>Your gym workspace</h1>
        <p>
          ${s.failure && s.failure.code !== "sign_in_required"
            ? s.failure.message
            : "Sign in with your invited email to manage gym time."}
        </p>
        <a href="/sign-in">Sign in</a>${s.failure?.code === "unexpected"
          ? html`<button data-intent=${i.Retry}>Try again</button>`
          : nothing}`;
    return html`${s.failure
      ? html`<p role="alert">${s.failure.message}</p>`
      : nothing}${html`<div class="account-bar">
        <details class="account-menu">
          <summary>
            Account · ${session.organizer ? "Organizer" : "Coach"}
          </summary>
          <div class="menu-body">
            <p>${session.email}</p>
            <button ?disabled=${s.signingOut} data-intent=${i.Logout}>
              Sign out
            </button>
          </div>
        </details>
      </div>
      <gymtime-planner .session=${session}></gymtime-planner>
      <details class="connection">
        <summary>Connection status</summary>
        <gymtime-connection></gymtime-connection>
      </details>`}`;
  },
});
