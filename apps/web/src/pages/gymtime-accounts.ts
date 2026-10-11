import { command, css, define, html, nothing, type PropsOf } from "@gyral/core";
import { Either } from "effect";
import "../components/gymtime-help-tip.js";
import { idFrom, sessionProp } from "../components/props.js";
import { ApiFailure, type AccountAction } from "../domain/api.js";
import { accountsDriver, type Result } from "../runtime/commands.js";
import { remoteView, type Remote } from "./remote-view.js";
const props = { session: sessionProp() };
type Props = PropsOf<typeof props>;
interface State {
  readonly accounts: Remote<Result<"accounts">>;
  readonly action: Remote<Result<"accounts">>;
}
type Msg =
  | { readonly _tag: "Invite"; readonly action: AccountAction }
  | { readonly _tag: "Toggle"; readonly id: number }
  | { readonly _tag: "Loaded"; readonly result: Result<"accounts"> }
  | { readonly _tag: "Saved"; readonly result: Result<"accounts"> }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure };
const load = () =>
  command(
    accountsDriver,
    { type: "list" },
    {
      key: "accounts-load",
      concurrency: "switch",
      onSuccess: (result): Msg => ({ _tag: "Loaded", result }),
      onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
    },
  );
const save = (action: AccountAction) =>
  command(accountsDriver, action, {
    key: "accounts-save",
    concurrency: "exhaust",
    onSuccess: (result): Msg => ({ _tag: "Saved", result }),
    onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
  });
export const GymtimeAccounts = define<State, Msg, Props>()("gymtime-accounts", {
  props,
  styles: css`
    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    :host {
      display: block;
      margin-block: 2rem;
    }
    h2 {
      font-size: 1.65rem;
    }
    p {
      line-height: 1.6;
    }
    form {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 1rem;
      margin-block: 1.5rem;
    }
    label {
      display: grid;
      gap: 0.4rem;
    }
    input,
    select,
    button {
      box-sizing: border-box;
      font: inherit;
      min-block-size: 44px;
      padding: 0.6rem 0.8rem;
      color: var(--text);
      background: var(--surface-raised);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
    }
    input {
      inline-size: min(20rem, 100%);
    }
    button {
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    ul {
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.75rem;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 0.6rem;
    }
    :focus-visible {
      outline: 3px solid var(--accent);
      outline-offset: 3px;
    }
  `,
  init: () => [
    { accounts: { _tag: "Loading" }, action: { _tag: "Idle" } },
    [load()],
  ],
  intent: {
    Invite: ({ formData }, { props: p }) => {
      const email = formData?.get("email");
      return typeof email === "string" && p.session
        ? {
            _tag: "Invite",
            action: {
              type: "invite",
              email,
              role:
                formData?.get("role") === "organizer" ? "organizer" : "coach",
              csrf: p.session.csrf_token,
            },
          }
        : undefined;
    },
    Toggle: ({ value }) => {
      const id = idFrom(value);
      return id ? { _tag: "Toggle", id } : undefined;
    },
  },
  update: {
    Invite: (s, m) =>
      s.action._tag === "Loading"
        ? s
        : [{ ...s, action: { _tag: "Loading" } }, [save(m.action)]],
    Toggle: (s, m, { props: p }) => {
      if (
        !p.session ||
        s.action._tag === "Loading" ||
        s.accounts._tag !== "Ready" ||
        Either.isLeft(s.accounts.value)
      )
        return s;
      const account = s.accounts.value.right.find((a) => a.user_id === m.id);
      return !account
        ? s
        : [
            { ...s, action: { _tag: "Loading" } },
            [
              save({
                type: "status",
                userId: m.id,
                enabled: !account.enabled,
                csrf: p.session.csrf_token,
              }),
            ],
          ];
    },
    Loaded: (s, m) => ({ ...s, accounts: { _tag: "Ready", value: m.result } }),
    Saved: (s, m) => ({
      ...s,
      action: { _tag: "Ready", value: m.result },
      accounts: Either.isRight(m.result)
        ? { _tag: "Ready", value: m.result }
        : s.accounts,
    }),
    Failed: (s, m) => ({
      ...s,
      accounts:
        s.accounts._tag === "Loading"
          ? { _tag: "Failed", failure: m.failure }
          : s.accounts,
      action: { _tag: "Failed", failure: m.failure },
    }),
  },
  view: (s, i) => {
    return html`<section aria-labelledby="accounts-title">
      <div class="section-heading">
        <h2 id="accounts-title">People and invitations</h2>
        <gymtime-help-tip topic="people"></gymtime-help-tip>
      </div>
      <p>
        Invite organizers and coaches by email. Team assignments control which
        bookings each coach can change. Disabling an account ends its signed-in
        sessions.
      </p>
      <form data-intent=${i.Invite}>
        <label
          >Email address<input
            name="email"
            type="email"
            required
            autocomplete="email"
            maxlength="254" /></label
        ><label
          >Role<select name="role">
            <option value="coach">Coach</option>
            <option value="organizer">Organizer</option>
          </select></label
        ><button ?disabled=${s.action._tag === "Loading"}>
          Send invitation
        </button>
      </form>
      ${remoteView(s.action, {
        loading: () => html`<p role="status">Saving…</p>`,
        ready: (value) =>
          Either.isLeft(value)
            ? html`<p role="alert">
                ${value.left.message}${value.left.issues.map(
                  (issue) => html`<br />${issue.message}`,
                )}
              </p>`
            : html`<p role="status">Account updated.</p>`,
        failed: () =>
          html`<p role="alert">
            The service could not be reached. Try again.
          </p>`,
        idle: () => nothing,
      })}
      ${remoteView(s.accounts, {
        loading: () => html`<p role="status">Loading invited accounts…</p>`,
        ready: (value) =>
          Either.isRight(value)
            ? html`<ul>
                ${value.right.map(
                  (account) =>
                    html`<li>
                      <span
                        ><strong>${account.email}</strong
                        ><br />${account.organizer ? "Organizer" : "Coach"} ·
                        ${account.enabled ? "Enabled" : "Disabled"}</span
                      ><button
                        ?disabled=${s.action._tag === "Loading"}
                        data-intent=${i.Toggle}
                        value=${account.user_id}
                        aria-label=${`${account.enabled ? "Disable" : "Enable"} ${account.email}`}
                      >
                        ${account.enabled ? "Disable" : "Enable"}
                      </button>
                    </li>`,
                )}
              </ul>`
            : html`<p role="alert">${value.left.message}</p>`,
        failed: () => html`<p role="alert">Accounts could not be loaded.</p>`,
      })}
    </section>`;
  },
});
