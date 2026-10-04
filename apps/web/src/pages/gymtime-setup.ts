import { consume } from "@lit/context";
import { Task } from "@lit/task";
import { Either } from "effect";
import { ApiFailure } from "../domain/api.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";
import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Schedule, ScheduleAction } from "../domain/schedule.js";
import { instantLabel } from "../domain/schedule.js";
import { FormErrors } from "../components/form-errors.js";
import "../components/gymtime-help-tip.js";
import { plannerStyles } from "../components/planner-styles.js";
import {
  emitAction,
  formValues,
  text,
  number,
  spaceField,
  spaceInput,
  slotLabel,
} from "../components/planner-forms.js";
@customElement("gymtime-setup")
export class GymtimeSetup extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  @property({ attribute: false }) schedule?: Schedule;
  private readonly accounts = new Task(this, {
    args: () => [this.adapter, this.schedule] as const,
    task: ([adapter], { signal }) =>
      adapter
        ? adapter.accounts({ type: "list" }, signal)
        : Promise.resolve(
            Either.left(
              new ApiFailure({
                code: "network",
                message: "Coach assignments are loading.",
                issues: [],
              }),
            ),
          ),
  });
  private coachEmail(id: number) {
    const value = this.accounts.value;
    return value && Either.isRight(value)
      ? (value.right.find((account) => account.user_id === id)?.email ?? "")
      : "";
  }
  @property() focusSection = "";
  @property({ type: Number }) season = 0;
  override updated(changed: PropertyValues<this>) {
    if (changed.has("focusSection") && this.focusSection) {
      const heading = this.renderRoot.querySelector<HTMLElement>(
        `#${this.focusSection}`,
      );
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        heading.scrollIntoView({ block: "start" });
      }
    }
  }
  @state() private publishedDate = "";
  @property({ type: Boolean }) busy = false;
  @property({ attribute: false }) issues: ReadonlyArray<{
    readonly field: string;
    readonly message: string;
  }> = [];
  private readonly errors = new FormErrors(this, () => this.issues);
  static override styles = plannerStyles;
  private submit(
    event: SubmitEvent,
    make: (f: FormData) => ScheduleAction,
    options: {
      readonly confirmation?: string;
      readonly preview?: boolean;
    } = {},
  ) {
    this.errors.remember(event);
    const f = formValues(event);
    if (f) emitAction(this, make(f), options);
  }
  override render() {
    const s = this.schedule;
    if (!s) return html``;
    const g = s.gym;
    return html` <section aria-labelledby="gym-setup">
        <div class="section-heading">
          <h2 id="gym-setup">Gym settings</h2>
          <gymtime-help-tip topic="hours"></gymtime-help-tip>
        </div>
        <p class="muted">
          Define opening hours first, then create seasons, teams, and bookable
          slots. Changes to hours or timezone apply to new slots; existing
          bookings keep their actual times.
        </p>
        <form
          @submit=${(e: SubmitEvent) =>
            this.submit(e, (f) => ({
              operation: "configure_gym",
              name: text(f, "name"),
              timezone: text(f, "timezone"),
              split: f.has("split"),
              version: g.version,
              hours: [0, 1, 2, 3, 4, 5, 6]
                .filter((d) => f.has(`day-${d}`))
                .map((d) => ({
                  weekday: d,
                  start: text(f, `start-${d}`),
                  end: text(f, `end-${d}`),
                })),
            }))}
        >
          <fieldset ?disabled=${this.busy}>
            <div class="fields">
              <label
                >Gym name<input
                  name="name"
                  required
                  maxlength="120"
                  .value=${g.name} /></label
              ><label
                >Gym timezone<input
                  name="timezone"
                  required
                  .value=${g.timezone}
                  aria-describedby="timezone-help" /></label
              ><label class="check"
                ><input name="split" type="checkbox" .checked=${g.split} />Gym
                can be split into two halves</label
              >
            </div>
            <p id="timezone-help" class="muted">
              Use an IANA timezone, such as America/New_York.
            </p>
            <fieldset>
              <legend>Weekly opening hours</legend>
              <div class="cards">
                ${[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((name, d) => {
                  const h = g.hours.find((h) => h.weekday === d);
                  return html`<div class="card">
                    <label class="check"
                      ><input
                        type="checkbox"
                        name=${`day-${d}`}
                        .checked=${Boolean(h)}
                      />${name} open</label
                    >
                    <div class="fields">
                      <label
                        >${name} opens<input
                          type="time"
                          name=${`start-${d}`}
                          .value=${h?.start ?? "08:00"}
                          required /></label
                      ><label
                        >${name} closes<input
                          type="time"
                          name=${`end-${d}`}
                          .value=${h?.end ?? "22:00"}
                          required
                      /></label>
                    </div>
                  </div>`;
                })}
              </div>
            </fieldset>
            <p><button class="primary">Save gym settings</button></p>
          </fieldset>
        </form>
      </section>
      <section aria-labelledby="seasons">
        <div class="section-heading">
          <h2 id="seasons">Seasons</h2>
          <gymtime-help-tip topic="seasons"></gymtime-help-tip>
        </div>
        <p class="muted">
          Prepare future seasons as drafts. Activate one season when coaches can
          request time; closed seasons remain in history.
        </p>
        <form
          @submit=${(e: SubmitEvent) =>
            this.submit(e, (f) => ({
              operation: "create_season",
              name: text(f, "name"),
              start_date: text(f, "start_date"),
              end_date: text(f, "end_date"),
            }))}
        >
          <fieldset class="fields" ?disabled=${this.busy}>
            <label
              >Season name<input
                name="name"
                required
                maxlength="120"
                placeholder="Winter basketball" /></label
            ><label
              >Season starts<input
                name="start_date"
                type="date"
                required
                min="2000-01-01"
                max="2100-12-31" /></label
            ><label
              >Season ends<input
                name="end_date"
                type="date"
                required
                min="2000-01-01"
                max="2100-12-31" /></label
            ><button class="primary">Create draft season</button>
          </fieldset>
        </form>
        <div class="cards">
          ${s.seasons.map(
            (season) =>
              html`<article class="card">
                <h3>${season.name}</h3>
                <span class="badge">${season.status}</span>
                <p>${season.start_date} – ${season.end_date}</p>
                ${season.status !== "closed"
                  ? html`<div class="actions">
                        ${season.status === "draft"
                          ? html`<button
                              ?disabled=${this.busy}
                              @click=${() =>
                                emitAction(
                                  this,
                                  {
                                    operation: "set_season_status",
                                    id: season.id,
                                    status: "active",
                                    version: season.version,
                                  },
                                  {
                                    confirmation: `Activate ${season.name}? Coaches associated with this season will be able to request its published slots.`,
                                  },
                                )}
                            >
                              Activate season
                            </button>`
                          : html``}<button
                          ?disabled=${this.busy}
                          @click=${() =>
                            emitAction(
                              this,
                              {
                                operation: "set_season_status",
                                id: season.id,
                                status: "closed",
                                version: season.version,
                              },
                              {
                                confirmation: `Close ${season.name}? Its schedule will become read-only. Team calendar subscriptions retain published events.`,
                              },
                            )}
                        >
                          Close season
                        </button>
                      </div>
                      <details>
                        <summary>Edit season</summary>
                        <form
                          @submit=${(e: SubmitEvent) =>
                            this.submit(e, (f) => ({
                              operation: "edit_season",
                              id: season.id,
                              name: text(f, "name"),
                              start_date: text(f, "start_date"),
                              end_date: text(f, "end_date"),
                              version: season.version,
                            }))}
                        >
                          <fieldset class="fields" ?disabled=${this.busy}>
                            <label
                              >Season name<input
                                name="name"
                                required
                                maxlength="120"
                                .value=${season.name} /></label
                            ><label
                              >Starts<input
                                name="start_date"
                                type="date"
                                required
                                .value=${season.start_date} /></label
                            ><label
                              >Ends<input
                                name="end_date"
                                type="date"
                                required
                                .value=${season.end_date} /></label
                            ><button>Save season</button>
                          </fieldset>
                        </form>
                      </details>`
                  : html``}
              </article>`,
          )}
        </div>
      </section>
      <section aria-labelledby="team-setup">
        <div class="section-heading">
          <h2 id="team-setup">Teams and coaches</h2>
          <gymtime-help-tip topic="people"></gymtime-help-tip>
        </div>
        <p class="muted">
          A team has one primary coach and any number of assistant coaches. The
          same coach can manage several teams.
        </p>
        <form
          @submit=${(e: SubmitEvent) =>
            this.submit(e, (f) => ({
              operation: "create_team",
              name: text(f, "name"),
              primary: text(f, "primary"),
              season: number(f, "season"),
            }))}
        >
          <fieldset class="fields" ?disabled=${this.busy || !s.seasons.length}>
            <label
              >Team name<input
                name="name"
                required
                maxlength="120"
                placeholder="School 4th Grade Basketball" /></label
            ><label
              >Primary coach email<input
                name="primary"
                type="email"
                required
                autocomplete="email" /></label
            ><label
              >Team season<select name="season" required>
                ${s.seasons
                  .filter((v) => v.status !== "closed")
                  .map(
                    (v) =>
                      html`<option
                        value=${v.id}
                        ?selected=${v.id === this.season}
                      >
                        ${v.name}
                      </option>`,
                  )}
              </select></label
            ><button class="primary">Create team and invite coach</button>
          </fieldset>
        </form>
        <div class="cards">
          ${s.teams.map(
            (team) =>
              html`<article class="card">
                <h3>${team.name}</h3>
                <p>
                  Primary coach:
                  ${this.coachEmail(team.primary) || "Loading coach…"}
                </p>
                <p>
                  Assistant coaches:
                  ${team.assistants.length
                    ? team.assistants
                        .map((id) => this.coachEmail(id))
                        .join(", ")
                    : "None assigned"}
                </p>
                <details>
                  <summary>Edit team and primary coach</summary>
                  <form
                    @submit=${(e: SubmitEvent) =>
                      this.submit(e, (f) => ({
                        operation: "edit_team",
                        id: team.id,
                        name: text(f, "name"),
                        primary: text(f, "primary"),
                        version: team.version,
                      }))}
                  >
                    <fieldset ?disabled=${this.busy}>
                      <label
                        >Team name<input
                          name="name"
                          required
                          maxlength="120"
                          .value=${team.name} /></label
                      ><label
                        >Primary coach email<input
                          name="primary"
                          type="email"
                          required
                          autocomplete="email"
                          .value=${this.coachEmail(team.primary)} /></label
                      ><button>Save team</button>
                    </fieldset>
                  </form>
                </details>
                <details>
                  <summary>Manage assistant coaches</summary>
                  <form
                    @submit=${(e: SubmitEvent) =>
                      this.submit(e, (f) => ({
                        operation: "assign_assistant",
                        team: team.id,
                        email: text(f, "email"),
                        remove: text(f, "action") === "remove",
                        version: team.version,
                      }))}
                  >
                    <fieldset ?disabled=${this.busy}>
                      <label
                        >Assistant coach email<input
                          type="email"
                          name="email"
                          required
                          autocomplete="email" /></label
                      ><label
                        >Assignment<select name="action">
                          <option value="add">Invite or add assistant</option>
                          <option value="remove">Remove assistant</option>
                        </select></label
                      ><button>Save assistant assignment</button>
                    </fieldset>
                  </form>
                </details>
                <form
                  @submit=${(e: SubmitEvent) =>
                    this.submit(e, (f) => ({
                      operation: "assign_team_season",
                      team: team.id,
                      season: number(f, "season"),
                      version: team.version,
                    }))}
                >
                  <fieldset class="fields" ?disabled=${this.busy}>
                    <label
                      >Add team to season<select name="season" required>
                        ${s.seasons
                          .filter(
                            (v) =>
                              v.status !== "closed" &&
                              !team.seasons.includes(v.id),
                          )
                          .map(
                            (v) =>
                              html`<option
                                value=${v.id}
                                ?selected=${v.id === this.season}
                              >
                                ${v.name}
                              </option>`,
                          )}
                      </select></label
                    ><button>Add season</button>
                  </fieldset>
                </form>
              </article>`,
          )}
        </div>
      </section>
      <section aria-labelledby="slots">
        <div class="section-heading">
          <h2 id="slots">Define bookable slots</h2>
          <gymtime-help-tip topic="hours"></gymtime-help-tip>
        </div>
        <p class="muted">
          Create one date or a weekly series. Preview every date before saving.
          Times use ${g.timezone}.
        </p>
        <form
          @submit=${(e: SubmitEvent) =>
            this.submit(
              e,
              (f) => ({
                operation: "create_slots",
                season: number(f, "season"),
                start_date: text(f, "start_date"),
                end_date: text(f, "end_date"),
                weekdays: f.getAll("weekdays").map((v) => Number(v)),
                start: text(f, "start"),
                end: text(f, "end"),
                space: spaceInput(f),
              }),
              { preview: true },
            )}
        >
          <fieldset ?disabled=${this.busy}>
            <div class="fields">
              <label
                >Season<select name="season" required>
                  ${s.seasons
                    .filter((v) => v.status !== "closed")
                    .map(
                      (v) =>
                        html`<option
                          value=${v.id}
                          ?selected=${v.id === this.season}
                        >
                          ${v.name}
                        </option>`,
                    )}
                </select></label
              ><label
                >First date<input
                  name="start_date"
                  type="date"
                  required /></label
              ><label
                >Last date<input name="end_date" type="date" required /></label
              ><label
                >Slot starts<input type="time" name="start" required /></label
              ><label>Slot ends<input type="time" name="end" required /></label
              >${spaceField(g.split)}
            </div>
            <fieldset>
              <legend>Days to include</legend>
              <div class="actions">
                ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (d, i) =>
                    html`<label class="check"
                      ><input
                        type="checkbox"
                        name="weekdays"
                        value=${i}
                      />${d}</label
                    >`,
                )}
              </div>
            </fieldset>
            <button class="primary">Preview slots</button>
          </fieldset>
        </form>
      </section>
      <section aria-labelledby="published-slots">
        <h2 id="published-slots">Manage published slots</h2>
        <label
          >Published date<input
            type="date"
            .value=${this.publishedDate}
            @change=${(event: Event) => {
              if (event.currentTarget instanceof HTMLInputElement)
                this.publishedDate = event.currentTarget.value;
            }} /></label
        >${!this.publishedDate
          ? html`<p class="muted">
              Choose a date to inspect, edit or unpublish its slots.
            </p>`
          : nothing}
        <div class="cards">
          ${s.slots
            .filter((slot) => slot.date === this.publishedDate)
            .map(
              (slot) =>
                html`<article class="card">
                  <h3>${slotLabel(slot)}</h3>
                  <span class="badge"
                    >${slot.enabled
                      ? slot.available
                        ? "Available"
                        : "Unavailable"
                      : "Unpublished"}</span
                  >${slot.starts_at > s.now &&
                  s.seasons.some(
                    (season) =>
                      season.id === slot.season && season.status !== "closed",
                  )
                    ? html`<details>
                          <summary>Edit slot</summary>
                          <form
                            @submit=${(event: SubmitEvent) =>
                              this.submit(event, (form) => ({
                                operation: "edit_slot",
                                id: slot.id,
                                date: text(form, "date"),
                                start: text(form, "start"),
                                end: text(form, "end"),
                                space: spaceInput(form),
                                version: slot.version,
                              }))}
                          >
                            <fieldset ?disabled=${this.busy}>
                              <label
                                >Date<input
                                  name="date"
                                  type="date"
                                  .value=${slot.date}
                                  required /></label
                              ><label
                                >Starts<input
                                  name="start"
                                  type="time"
                                  .value=${slot.start}
                                  required /></label
                              ><label
                                >Ends<input
                                  name="end"
                                  type="time"
                                  .value=${slot.end}
                                  required /></label
                              >${spaceField(g.split, slot.space)}<button>
                                Save slot
                              </button>
                            </fieldset>
                          </form>
                        </details>
                        <button
                          ?disabled=${this.busy}
                          @click=${() =>
                            emitAction(
                              this,
                              {
                                operation: "set_slot_enabled",
                                id: slot.id,
                                enabled: !slot.enabled,
                                version: slot.version,
                              },
                              {
                                confirmation: `${slot.enabled ? "Unpublish" : "Publish"} this slot? Occupied slots must be cancelled or rescheduled first.`,
                              },
                            )}
                        >
                          ${slot.enabled ? "Unpublish slot" : "Publish slot"}
                        </button>`
                    : nothing}
                </article>`,
            )}
        </div>
      </section>
      <section aria-labelledby="closures">
        <div class="section-heading">
          <h2 id="closures">Gym unavailable</h2>
          <gymtime-help-tip topic="closures"></gymtime-help-tip>
        </div>
        <p class="muted">
          A closure cancels every affected confirmed booking and pending
          request. Coaches receive the reason. Cancelled bookings stay in
          history; reopening time does not restore them.
        </p>
        <form
          @submit=${(e: SubmitEvent) =>
            this.submit(
              e,
              (f) => ({
                operation: "close_gym",
                start_date: text(f, "start_date"),
                end_date: text(f, "end_date"),
                start: text(f, "start"),
                end: text(f, "end"),
                space: spaceInput(f),
                reason: text(f, "reason"),
              }),
              { preview: true },
            )}
        >
          <fieldset ?disabled=${this.busy}>
            <div class="fields">
              <label
                >Closure starts on<input
                  type="date"
                  name="start_date"
                  required /></label
              ><label
                >Starts at<input type="time" name="start" required /></label
              ><label
                >Closure ends on<input
                  type="date"
                  name="end_date"
                  required /></label
              ><label>Ends at<input type="time" name="end" required /></label
              >${spaceField(g.split)}
            </div>
            <label
              >Reason<textarea
                name="reason"
                required
                maxlength="2000"
              ></textarea></label
            ><button>Preview closure</button>
          </fieldset>
        </form>
        <ul class="plain-list">
          ${s.closures.map(
            (c) =>
              html`<li class="card">
                <strong>${c.reason}</strong
                ><span
                  >${instantLabel(c.starts_at, g.timezone)} –
                  ${instantLabel(c.ends_at, g.timezone)} ·
                  ${c.space.replaceAll("_", " ")}</span
                ><span>${c.active ? "Unavailable" : "Reopened"}</span
                >${c.active && c.ends_at > s.now
                  ? html`<button
                      ?disabled=${this.busy}
                      @click=${() =>
                        emitAction(
                          this,
                          {
                            operation: "reopen_gym",
                            id: c.id,
                            version: c.version,
                          },
                          {
                            confirmation:
                              "Reopen this gym time? Previous bookings stay cancelled. Coaches can request available slots again.",
                          },
                        )}
                    >
                      Reopen time
                    </button>`
                  : html``}
              </li>`,
          )}
        </ul>
      </section>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-setup": GymtimeSetup;
  }
}
