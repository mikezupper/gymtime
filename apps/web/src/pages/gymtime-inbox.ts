import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { Either } from "effect";
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";
import { ApiFailure, type Session } from "../domain/api.js";
import { instantLabel } from "../domain/schedule.js";
import "../components/gymtime-help-tip.js";
import { plannerStyles } from "../components/planner-styles.js";
import { emitAction } from "../components/planner-forms.js";
@customElement("gymtime-inbox")
export class GymtimeInbox extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  @property({ attribute: false }) session?: Session;
  @property({ type: Boolean }) busy = false;
  @state() private failedOnly = false;
  @state() private page = 0;
  private readonly inbox = new Task(this, {
    args: () => [this.adapter, this.failedOnly, this.busy] as const,
    task: ([adapter, failedOnly], { signal }) =>
      adapter
        ? adapter.notices(failedOnly, signal)
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
  private readonly history = new Task(this, {
    args: () => [this.adapter, this.session, this.busy] as const,
    task: ([adapter, session], { signal }) =>
      adapter && session?.organizer
        ? adapter.audit(signal)
        : Promise.resolve(undefined),
  });
  static override styles = plannerStyles;
  override render() {
    return html`<section aria-labelledby="inbox-title">
        <div class="section-heading">
          <h2 id="inbox-title">Notifications</h2>
          <gymtime-help-tip topic="notices"></gymtime-help-tip>
        </div>
        <p class="muted">
          Schedule messages appear here even if email delivery fails. Related
          dates from one action are grouped into one message.
        </p>
        <div class="actions">
          <button @click=${() => this.inbox.run()}>Refresh notifications</button
          >${this.session?.organizer
            ? html`<label class="check"
                ><input
                  type="checkbox"
                  .checked=${this.failedOnly}
                  @change=${() => {
                    this.failedOnly = !this.failedOnly;
                    this.page = 0;
                  }}
                />Show failed email deliveries for all accounts</label
              >`
            : nothing}
        </div>
        ${this.inbox.render({
          pending: () => html`<p role="status">Loading notifications…</p>`,
          complete: (r) =>
            Either.isLeft(r)
              ? html`<p role="alert">${r.left.message}</p>`
              : html`<ul class="plain-list">
                    ${r.right.slice(this.page * 20, this.page * 20 + 20).map(
                      (n) =>
                        html`<li class="card">
                          <h3>${n.subject}</h3>
                          <span class="badge"
                            >${n.read ? "Read" : "Unread"} · Email
                            ${n.delivery}</span
                          ><time
                            datetime=${new Date(n.created_at).toISOString()}
                            >${instantLabel(n.created_at, "UTC")} UTC</time
                          >${this.failedOnly
                            ? html`<p>To: ${n.recipient}</p>`
                            : nothing}
                          <details>
                            <summary>Read message</summary>
                            <pre>${n.text}</pre>
                          </details>
                          <div class="actions">
                            ${!n.read && n.user_id === this.session?.user_id
                              ? html`<button
                                  ?disabled=${this.busy}
                                  @click=${() =>
                                    emitAction(this, {
                                      operation: "mark_notice_read",
                                      id: n.id,
                                    })}
                                >
                                  Mark as read
                                </button>`
                              : nothing}${this.session?.organizer &&
                            n.delivery === "failed"
                              ? html`<button
                                  ?disabled=${this.busy}
                                  @click=${() =>
                                    emitAction(
                                      this,
                                      { operation: "retry_email", id: n.id },
                                      {
                                        confirmation: `Retry this email to ${n.recipient}? It uses the original delivery key to avoid duplicate provider delivery.`,
                                      },
                                    )}
                                >
                                  Retry email delivery
                                </button>`
                              : nothing}
                          </div>
                        </li>`,
                    )}
                  </ul>
                  <div class="actions">
                    <button
                      ?disabled=${this.page === 0}
                      @click=${() => {
                        this.page -= 1;
                      }}
                    >
                      Previous messages</button
                    ><span
                      >Page ${this.page + 1} of
                      ${Math.max(1, Math.ceil(r.right.length / 20))}</span
                    ><button
                      ?disabled=${(this.page + 1) * 20 >= r.right.length}
                      @click=${() => {
                        this.page += 1;
                      }}
                    >
                      Next messages
                    </button>
                  </div>
                  ${!r.right.length
                    ? html`<p>
                        ${this.failedOnly
                          ? "No failed email deliveries."
                          : "No notifications yet."}
                      </p>`
                    : nothing}`,
          error: () =>
            html`<p role="alert">Notifications could not be reached.</p>`,
        })}
      </section>
      ${this.session?.organizer
        ? html`<details>
            <summary>Recent activity</summary>
            <section aria-labelledby="audit-title">
              <h2 id="audit-title">Recent activity</h2>
              <p class="muted">
                The most recent 200 sign-in, account, and scheduling actions.
              </p>
              ${this.history.render({
                pending: () =>
                  html`<p role="status">Loading recent activity…</p>`,
                complete: (r) =>
                  r && Either.isRight(r)
                    ? html`<ul class="plain-list">
                        ${r.right.map(
                          (a) =>
                            html`<li>
                              Account ${a.actor}:
                              ${a.action.replaceAll("_", " ")} ·
                              ${instantLabel(a.occurred_at, "UTC")} UTC
                            </li>`,
                        )}
                      </ul>`
                    : html`<p>Recent activity is unavailable.</p>`,
                error: () =>
                  html`<p role="alert">Recent activity is unavailable.</p>`,
              })}
            </section>
          </details>`
        : nothing}`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-inbox": GymtimeInbox;
  }
}
