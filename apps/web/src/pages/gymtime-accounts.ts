import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { Either } from "effect";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ApiFailure, type AccountAction, type Session } from "../domain/api.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";
import "../components/gymtime-help-tip.js";

@customElement("gymtime-accounts")
export class GymtimeAccounts extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  @property({ attribute: false }) session?: Session;
  @state() private operation: AccountAction = { type: "list" };
  private readonly accounts = new Task(this, {
    args: () => [this.adapter, this.session] as const,
    task: ([adapter], { signal }) =>
      adapter
        ? adapter.accounts({ type: "list" }, signal)
        : Promise.resolve(
            Either.left(
              new ApiFailure({
                code: "network",
                message: "The app is loading.",
                issues: [],
              }),
            ),
          ),
  });
  private readonly action = new Task(this, {
    autoRun: false,
    args: () => [this.adapter, this.operation] as const,
    task: ([adapter, operation], { signal }) =>
      adapter
        ? adapter.accounts(operation, signal).then((result) => {
            if (Either.isRight(result)) void this.accounts.run();
            return result;
          })
        : Promise.resolve(
            Either.left(
              new ApiFailure({
                code: "network",
                message: "The app is loading.",
                issues: [],
              }),
            ),
          ),
  });
  static override styles = css`
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
  `;
  private invite(event: SubmitEvent) {
    event.preventDefault();
    if (!this.session || !(event.currentTarget instanceof HTMLFormElement))
      return;
    const values = new FormData(event.currentTarget);
    this.operation = {
      type: "invite",
      email: String(values.get("email") ?? ""),
      role: values.get("role") === "organizer" ? "organizer" : "coach",
      csrf: this.session.csrf_token,
    };
    void this.action.run();
  }
  private toggle(userId: number, enabled: boolean) {
    if (!this.session) return;
    this.operation = {
      type: "status",
      userId,
      enabled,
      csrf: this.session.csrf_token,
    };
    void this.action.run();
  }
  override render() {
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
      <form @submit=${this.invite}>
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
        ><button ?disabled=${this.action.status === TaskStatus.PENDING}>
          Send invitation
        </button>
      </form>
      ${this.action.render({
        pending: () => html`<p role="status">Saving…</p>`,
        complete: (value) =>
          Either.isLeft(value)
            ? html`<p role="alert">
                ${value.left.message}${value.left.issues.map(
                  (issue) => html`<br />${issue.message}`,
                )}
              </p>`
            : html`<p role="status">Account updated.</p>`,
        error: () =>
          html`<p role="alert">
            The service could not be reached. Try again.
          </p>`,
        initial: () => nothing,
      })}
      ${this.accounts.render({
        pending: () => html`<p role="status">Loading invited accounts…</p>`,
        complete: (value) =>
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
                        ?disabled=${this.action.status === TaskStatus.PENDING}
                        @click=${() =>
                          this.toggle(account.user_id, !account.enabled)}
                        aria-label=${`${account.enabled ? "Disable" : "Enable"} ${account.email}`}
                      >
                        ${account.enabled ? "Disable" : "Enable"}
                      </button>
                    </li>`,
                )}
              </ul>`
            : html`<p role="alert">${value.left.message}</p>`,
        error: () => html`<p role="alert">Accounts could not be loaded.</p>`,
      })}
    </section>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-accounts": GymtimeAccounts;
  }
}
