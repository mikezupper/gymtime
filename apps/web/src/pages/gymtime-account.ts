import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { Either } from "effect";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ApiFailure } from "../domain/api.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";
import "./gymtime-planner.js";
import "./gymtime-connection.js";

@customElement("gymtime-account")
export class GymtimeAccount extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  private readonly session = new Task(this, {
    args: () => [this.adapter] as const,
    task: ([adapter], { signal }) =>
      adapter
        ? adapter.auth({ type: "session" }, signal)
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
  `;
  private csrf = "";
  private readonly signOut = new Task(this, {
    autoRun: false,
    args: () => [this.adapter, this.csrf] as const,
    task: ([adapter, csrf], { signal }) =>
      adapter
        ? adapter.auth({ type: "logout", csrf }, signal).then((result) => {
            if (Either.isRight(result)) window.location.assign("/sign-in");
            return result;
          })
        : Promise.resolve(undefined),
  });
  private logout(csrf: string) {
    this.csrf = csrf;
    void this.signOut.run();
  }
  override render() {
    return html`${this.signOut.render({
      complete: (r) =>
        r && Either.isLeft(r)
          ? html`<p role="alert">${r.left.message}</p>`
          : html``,
      error: () => html`<p role="alert">Sign-out failed. Try again.</p>`,
    })}${this.session.render({
      pending: () => html`<p role="status">Checking your account…</p>`,
      complete: (result) =>
        Either.isRight(result) && result.right.type === "session"
          ? html`<div class="account-bar">
                <details class="account-menu">
                  <summary>
                    Account ·
                    ${result.right.session.organizer ? "Organizer" : "Coach"}
                  </summary>
                  <div class="menu-body">
                    <p>${result.right.session.email}</p>
                    <button
                      ?disabled=${this.signOut.status === TaskStatus.PENDING}
                      @click=${() => {
                        if (
                          Either.isRight(result) &&
                          result.right.type === "session"
                        )
                          this.logout(result.right.session.csrf_token);
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </details>
              </div>
              <gymtime-planner
                .session=${result.right.session}
              ></gymtime-planner>
              <details class="connection">
                <summary>Connection status</summary>
                <gymtime-connection></gymtime-connection>
              </details>`
          : html`<h1>Your gym workspace</h1>
              <p>
                ${Either.isLeft(result) &&
                result.left.code !== "sign_in_required"
                  ? result.left.message
                  : "Sign in with your invited email to manage gym time."}
              </p>
              <a href="/sign-in">Sign in</a>`,
      error: () =>
        html`<h1>Your gym workspace</h1>
          <p>The service could not be reached.</p>
          <button
            ?disabled=${this.signOut.status === TaskStatus.PENDING}
            @click=${() => this.session.run()}
          >
            Try again
          </button>`,
    })}`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-account": GymtimeAccount;
  }
}
