import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { Either } from "effect";
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Revalidate } from "../components/revalidate.js";
import { ApiFailure } from "../domain/api.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";
import { parentGuide } from "../components/parent-guide.js";
import { plannerStyles } from "../components/planner-styles.js";
import { instantLabel, spaceLabel } from "../domain/schedule.js";
@customElement("gymtime-team-calendar")
export class GymtimeTeamCalendar extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  @property() token = "";
  @state() private date = "";
  @state() private page = 0;
  private readonly revalidation = new Revalidate(this, () => {
    if (this.calendar.status !== TaskStatus.PENDING) void this.calendar.run();
  });
  private readonly calendar = new Task(this, {
    args: () => [this.adapter, this.token] as const,
    task: ([adapter, token], { signal }) =>
      adapter
        ? adapter.publicCalendar(token, signal)
        : Promise.resolve(
            Either.left(
              new ApiFailure({
                code: "network",
                message: "The calendar is loading.",
                issues: [],
              }),
            ),
          ),
  });
  static override styles = plannerStyles;
  override render() {
    return this.calendar.render({
      pending: () =>
        html`<h1>Team calendar</h1>
          <p role="status">Loading confirmed team times…</p>`,
      complete: (r) =>
        Either.isLeft(r)
          ? html`<h1>Team calendar unavailable</h1>
              <p>
                ${r.left.code === "not_found"
                  ? "This link may have been replaced. Ask your team's coach for the current link."
                  : r.left.message}
              </p>
              <button @click=${() => this.calendar.run()}>Try again</button>`
          : html`<h1>${r.right.team}</h1>
              <section>
                <h2>Confirmed team schedule</h2>
                <p>${r.right.gym} · All times use ${r.right.timezone}.</p>
                <div class="actions">
                  <a href=${r.right.subscription_url}
                    >Subscribe to team calendar</a
                  ><a href=${r.right.calendar_url} download
                    >Download calendar file</a
                  ><button @click=${() => this.calendar.run()}>
                    Refresh team schedule
                  </button>
                </div>
                ${parentGuide(r.right.calendar_url)}
                <label
                  >Show from date<input
                    type="date"
                    .value=${this.date}
                    @change=${(event: Event) => {
                      if (event.currentTarget instanceof HTMLInputElement) {
                        this.date = event.currentTarget.value;
                        this.page = 0;
                      }
                    }}
                /></label>
                <ul class="plain-list">
                  ${r.right.events
                    .filter(
                      (e) =>
                        !e.cancelled &&
                        (!this.date ||
                          new Intl.DateTimeFormat("en-CA", {
                            timeZone: r.right.timezone,
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }).format(e.starts_at) >= this.date),
                    )
                    .slice(this.page * 20, this.page * 20 + 20)
                    .map(
                      (e) =>
                        html`<li class="card">
                          <h3>
                            ${e.activity === "practice" ? "Practice" : "Game"}
                          </h3>
                          <time datetime=${new Date(e.starts_at).toISOString()}
                            >${instantLabel(
                              e.starts_at,
                              r.right.timezone,
                            )}</time
                          ><span
                            >Ends ${instantLabel(e.ends_at, r.right.timezone)} ·
                            ${spaceLabel(e.space)}</span
                          >
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
                    Previous events</button
                  ><span>Page ${this.page + 1}</span
                  ><button
                    ?disabled=${(this.page + 1) * 20 >=
                    r.right.events.filter(
                      (e) =>
                        !e.cancelled &&
                        (!this.date ||
                          new Intl.DateTimeFormat("en-CA", {
                            timeZone: r.right.timezone,
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }).format(e.starts_at) >= this.date),
                    ).length}
                    @click=${() => {
                      this.page += 1;
                    }}
                  >
                    Next events
                  </button>
                </div>
                ${!r.right.events.some((e) => !e.cancelled)
                  ? html`<p>
                      No confirmed team times yet. Check again after the
                      organizer approves the schedule.
                    </p>`
                  : html``}
              </section>`,
      error: () =>
        html`<h1>Team calendar</h1>
          <p role="alert">The service could not be reached.</p>
          <button @click=${() => this.calendar.run()}>Try again</button>`,
    });
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-team-calendar": GymtimeTeamCalendar;
  }
}
