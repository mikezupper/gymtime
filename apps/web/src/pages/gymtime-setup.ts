import {
  command,
  define,
  defineHook,
  html,
  type IntentInput,
  nothing,
  prop,
  type PropsOf,
} from "@gyral/core";
import { Either } from "effect";
import { formErrors } from "../components/form-errors.js";
import "../components/gymtime-help-tip.js";
import {
  emitSchedule,
  number,
  type ScheduleOutput,
  slotLabel,
  spaceField,
  spaceInput,
  text,
} from "../components/planner-forms.js";
import { plannerStyles } from "../components/planner-styles.js";
import {
  idFrom,
  issuesProp,
  noIssues,
  scheduleProp,
} from "../components/props.js";
import { type Accounts, ApiFailure } from "../domain/api.js";
import { instantLabel, type ScheduleAction } from "../domain/schedule.js";
import { accountsDriver, type Result } from "../runtime/commands.js";
const props = {
  schedule: scheduleProp(),
  focusSection: prop.string({ default: "" }),
  season: prop.number({ default: 0 }),
  busy: prop.boolean(),
  issues: issuesProp(),
  errorForm: prop.string({ default: "" }),
};
type Props = PropsOf<typeof props>;
interface State {
  readonly publishedDate: string;
  readonly accounts: typeof Accounts.Type;
  readonly failure: ApiFailure | undefined;
}
type Msg =
  | ScheduleOutput
  | { readonly _tag: "PublishedDate"; readonly date: string }
  | { readonly _tag: "AccountsLoaded"; readonly result: Result<"accounts"> }
  | { readonly _tag: "Failed"; readonly failure: ApiFailure };
const load = () =>
  command(
    accountsDriver,
    { type: "list" },
    {
      key: "accounts",
      concurrency: "switch",
      onSuccess: (result): Msg => ({ _tag: "AccountsLoaded", result }),
      onFailure: (failure): Msg => ({ _tag: "Failed", failure }),
    },
  );
const coachEmail = (state: State, id: number) =>
  state.accounts.find((a) => a.user_id === id)?.email ?? "";
const focusSection = defineHook<[active: boolean]>({
  client: (element, [active], previous) => {
    if (active && previous?.[0] !== true && element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "start" });
    }
  },
});
const output = (
  input: IntentInput,
  action: ScheduleAction,
  confirmation = "",
  preview = false,
): ScheduleOutput => ({
  _tag: "ScheduleAction",
  action,
  confirmation,
  preview,
  formKey: input.target.getAttribute("data-form-key") ?? "",
});
const resourceId = (input: IntentInput) =>
  idFrom(input.target.getAttribute("data-id") ?? undefined);
export const GymtimeSetup = define<State, Msg, Props, ScheduleOutput>()(
  "gymtime-setup",
  {
    props,
    styles: plannerStyles,
    init: () => [
      { publishedDate: "", accounts: [], failure: undefined },
      [load()],
    ],
    intent: {
      PublishedDate: ({ value }) => ({
        _tag: "PublishedDate",
        date: value ?? "",
      }),
      ConfigureGym: (input, { props: p }) => {
        const f = input.formData;
        const g = p.schedule?.gym;
        return !f || !g
          ? undefined
          : output(input, {
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
            });
      },
      CreateSeason: (input) => {
        const f = input.formData;
        return !f
          ? undefined
          : output(input, {
              operation: "create_season",
              name: text(f, "name"),
              start_date: text(f, "start_date"),
              end_date: text(f, "end_date"),
            });
      },
      SeasonStatus: (input, { props: p }) => {
        const season = p.schedule?.seasons.find(
          (s) => s.id === resourceId(input),
        );
        const status = input.target.getAttribute("data-status");
        return !season || (status !== "active" && status !== "closed")
          ? undefined
          : output(
              input,
              {
                operation: "set_season_status",
                id: season.id,
                status,
                version: season.version,
              },
              status === "active"
                ? `Activate ${season.name}? Coaches associated with this season will be able to request its published slots.`
                : `Close ${season.name}? Its schedule will become read-only. Team calendar subscriptions retain published events.`,
            );
      },
      EditSeason: (input, { props: p }) => {
        const f = input.formData;
        const season = p.schedule?.seasons.find(
          (s) => s.id === resourceId(input),
        );
        return !f || !season
          ? undefined
          : output(input, {
              operation: "edit_season",
              id: season.id,
              name: text(f, "name"),
              start_date: text(f, "start_date"),
              end_date: text(f, "end_date"),
              version: season.version,
            });
      },
      CreateTeam: (input) => {
        const f = input.formData;
        return !f
          ? undefined
          : output(input, {
              operation: "create_team",
              name: text(f, "name"),
              primary: text(f, "primary"),
              season: number(f, "season"),
            });
      },
      EditTeam: (input, { props: p }) => {
        const f = input.formData;
        const team = p.schedule?.teams.find((t) => t.id === resourceId(input));
        return !f || !team
          ? undefined
          : output(input, {
              operation: "edit_team",
              id: team.id,
              name: text(f, "name"),
              primary: text(f, "primary"),
              version: team.version,
            });
      },
      Assistant: (input, { props: p }) => {
        const f = input.formData;
        const team = p.schedule?.teams.find((t) => t.id === resourceId(input));
        return !f || !team
          ? undefined
          : output(input, {
              operation: "assign_assistant",
              team: team.id,
              email: text(f, "email"),
              remove: text(f, "action") === "remove",
              version: team.version,
            });
      },
      TeamSeason: (input, { props: p }) => {
        const f = input.formData;
        const team = p.schedule?.teams.find((t) => t.id === resourceId(input));
        return !f || !team
          ? undefined
          : output(input, {
              operation: "assign_team_season",
              team: team.id,
              season: number(f, "season"),
              version: team.version,
            });
      },
      CreateSlots: (input) => {
        const f = input.formData;
        return !f
          ? undefined
          : output(
              input,
              {
                operation: "create_slots",
                season: number(f, "season"),
                start_date: text(f, "start_date"),
                end_date: text(f, "end_date"),
                weekdays: f.getAll("weekdays").map((v) => Number(v)),
                start: text(f, "start"),
                end: text(f, "end"),
                space: spaceInput(f),
              },
              "",
              true,
            );
      },
      EditSlot: (input, { props: p }) => {
        const f = input.formData;
        const slot = p.schedule?.slots.find((s) => s.id === resourceId(input));
        return !f || !slot
          ? undefined
          : output(input, {
              operation: "edit_slot",
              id: slot.id,
              date: text(f, "date"),
              start: text(f, "start"),
              end: text(f, "end"),
              space: spaceInput(f),
              version: slot.version,
            });
      },
      SlotEnabled: (input, { props: p }) => {
        const slot = p.schedule?.slots.find((s) => s.id === resourceId(input));
        return !slot
          ? undefined
          : output(
              input,
              {
                operation: "set_slot_enabled",
                id: slot.id,
                enabled: !slot.enabled,
                version: slot.version,
              },
              `${slot.enabled ? "Unpublish" : "Publish"} this slot? Occupied slots must be cancelled or rescheduled first.`,
            );
      },
      CloseGym: (input) => {
        const f = input.formData;
        return !f
          ? undefined
          : output(
              input,
              {
                operation: "close_gym",
                start_date: text(f, "start_date"),
                end_date: text(f, "end_date"),
                start: text(f, "start"),
                end: text(f, "end"),
                space: spaceInput(f),
                reason: text(f, "reason"),
              },
              "",
              true,
            );
      },
      ReopenGym: (input, { props: p }) => {
        const closure = p.schedule?.closures.find(
          (c) => c.id === resourceId(input),
        );
        return !closure
          ? undefined
          : output(
              input,
              {
                operation: "reopen_gym",
                id: closure.id,
                version: closure.version,
              },
              "Reopen this gym time? Previous bookings stay cancelled. Coaches can request available slots again.",
            );
      },
    },
    update: {
      ScheduleAction: (s, m, { props: p }) =>
        p.busy ? s : [s, [emitSchedule(m)]],
      PublishedDate: (s, m) => ({ ...s, publishedDate: m.date }),
      AccountsLoaded: (s, m) => ({
        ...s,
        accounts: Either.isRight(m.result) ? m.result.right : s.accounts,
        failure: Either.isLeft(m.result) ? m.result.left : undefined,
      }),
      Failed: (s, m) => ({ ...s, failure: m.failure }),
      PropsChanged: (s, m) =>
        m.props.schedule === m.prev.schedule ? s : [s, [load()]],
    },
    view: (state, i, { props: p }) => {
      const s = p.schedule;
      if (!s) return html``;
      const g = s.gym;
      return html` <section aria-labelledby="gym-setup">
          <div class="section-heading">
            <h2
              id="gym-setup"
              tabindex="-1"
              ${focusSection(p.focusSection === "gym-setup")}
            >
              Gym settings
            </h2>
            <gymtime-help-tip topic="hours"></gymtime-help-tip>
          </div>
          <p class="muted">
            Define opening hours first, then create seasons, teams, and bookable
            slots. Changes to hours or timezone apply to new slots; existing
            bookings keep their actual times.
          </p>
          <form
            data-intent=${i.ConfigureGym}
            data-form-key=${"configure_gym"}
            ${formErrors(p.errorForm === "configure_gym" ? p.issues : noIssues)}
          >
            <fieldset ?disabled=${p.busy}>
              <div class="fields">
                <label
                  >Gym name<input
                    name="name"
                    required
                    maxlength="120"
                    value=${g.name} /></label
                ><label
                  >Gym timezone<input
                    name="timezone"
                    required
                    value=${g.timezone}
                    aria-describedby="timezone-help" /></label
                ><label class="check"
                  ><input name="split" type="checkbox" ?checked=${g.split} />Gym
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
                          ?checked=${Boolean(h)}
                        />${name} open</label
                      >
                      <div class="fields">
                        <label
                          >${name} opens<input
                            type="time"
                            name=${`start-${d}`}
                            value=${h?.start ?? "08:00"}
                            required /></label
                        ><label
                          >${name} closes<input
                            type="time"
                            name=${`end-${d}`}
                            value=${h?.end ?? "22:00"}
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
            <h2
              id="seasons"
              tabindex="-1"
              ${focusSection(p.focusSection === "seasons")}
            >
              Seasons
            </h2>
            <gymtime-help-tip topic="seasons"></gymtime-help-tip>
          </div>
          <p class="muted">
            Prepare future seasons as drafts. Activate one season when coaches
            can request time; closed seasons remain in history.
          </p>
          <form
            data-intent=${i.CreateSeason}
            data-form-key=${"create_season"}
            ${formErrors(p.errorForm === "create_season" ? p.issues : noIssues)}
          >
            <fieldset class="fields" ?disabled=${p.busy}>
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
                                ?disabled=${p.busy}
                                data-intent=${i.SeasonStatus}
                                data-id=${season.id}
                                data-status="active"
                              >
                                Activate season
                              </button>`
                            : html``}<button
                            ?disabled=${p.busy}
                            data-intent=${i.SeasonStatus}
                            data-id=${season.id}
                            data-status="closed"
                          >
                            Close season
                          </button>
                        </div>
                        <details>
                          <summary>Edit season</summary>
                          <form
                            data-intent=${i.EditSeason}
                            data-id=${season.id}
                            data-form-key=${`edit_season-${season.id}`}
                            ${formErrors(
                              p.errorForm === `edit_season-${season.id}`
                                ? p.issues
                                : noIssues,
                            )}
                          >
                            <fieldset class="fields" ?disabled=${p.busy}>
                              <label
                                >Season name<input
                                  name="name"
                                  required
                                  maxlength="120"
                                  value=${season.name} /></label
                              ><label
                                >Starts<input
                                  name="start_date"
                                  type="date"
                                  required
                                  value=${season.start_date} /></label
                              ><label
                                >Ends<input
                                  name="end_date"
                                  type="date"
                                  required
                                  value=${season.end_date} /></label
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
            <h2
              id="team-setup"
              tabindex="-1"
              ${focusSection(p.focusSection === "team-setup")}
            >
              Teams and coaches
            </h2>
            <gymtime-help-tip topic="people"></gymtime-help-tip>
          </div>
          <p class="muted">
            A team has one primary coach and any number of assistant coaches.
            The same coach can manage several teams.
          </p>
          <form
            data-intent=${i.CreateTeam}
            data-form-key=${"create_team"}
            ${formErrors(p.errorForm === "create_team" ? p.issues : noIssues)}
          >
            <fieldset class="fields" ?disabled=${p.busy || !s.seasons.length}>
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
                          ?selected=${v.id === p.season}
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
                    ${coachEmail(state, team.primary) || "Loading coach…"}
                  </p>
                  <p>
                    Assistant coaches:
                    ${team.assistants.length
                      ? team.assistants
                          .map((id) => coachEmail(state, id))
                          .join(", ")
                      : "None assigned"}
                  </p>
                  <details>
                    <summary>Edit team and primary coach</summary>
                    <form
                      data-intent=${i.EditTeam}
                      data-id=${team.id}
                      data-form-key=${`edit_team-${team.id}`}
                      ${formErrors(
                        p.errorForm === `edit_team-${team.id}`
                          ? p.issues
                          : noIssues,
                      )}
                    >
                      <fieldset ?disabled=${p.busy}>
                        <label
                          >Team name<input
                            name="name"
                            required
                            maxlength="120"
                            value=${team.name} /></label
                        ><label
                          >Primary coach email<input
                            name="primary"
                            type="email"
                            required
                            autocomplete="email"
                            value=${coachEmail(state, team.primary)} /></label
                        ><button>Save team</button>
                      </fieldset>
                    </form>
                  </details>
                  <details>
                    <summary>Manage assistant coaches</summary>
                    <form
                      data-intent=${i.Assistant}
                      data-id=${team.id}
                      data-form-key=${`assign_assistant-${team.id}`}
                      ${formErrors(
                        p.errorForm === `assign_assistant-${team.id}`
                          ? p.issues
                          : noIssues,
                      )}
                    >
                      <fieldset ?disabled=${p.busy}>
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
                    data-intent=${i.TeamSeason}
                    data-id=${team.id}
                    data-form-key=${`assign_team_season-${team.id}`}
                    ${formErrors(
                      p.errorForm === `assign_team_season-${team.id}`
                        ? p.issues
                        : noIssues,
                    )}
                  >
                    <fieldset class="fields" ?disabled=${p.busy}>
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
                                  ?selected=${v.id === p.season}
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
            <h2
              id="slots"
              tabindex="-1"
              ${focusSection(p.focusSection === "slots")}
            >
              Define bookable slots
            </h2>
            <gymtime-help-tip topic="hours"></gymtime-help-tip>
          </div>
          <p class="muted">
            Create one date or a weekly series. Preview every date before
            saving. Times use ${g.timezone}.
          </p>
          <form
            data-intent=${i.CreateSlots}
            data-form-key=${"create_slots"}
            ${formErrors(p.errorForm === "create_slots" ? p.issues : noIssues)}
          >
            <fieldset ?disabled=${p.busy}>
              <div class="fields">
                <label
                  >Season<select name="season" required>
                    ${s.seasons
                      .filter((v) => v.status !== "closed")
                      .map(
                        (v) =>
                          html`<option
                            value=${v.id}
                            ?selected=${v.id === p.season}
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
                  >Last date<input
                    name="end_date"
                    type="date"
                    required /></label
                ><label
                  >Slot starts<input type="time" name="start" required /></label
                ><label
                  >Slot ends<input type="time" name="end" required /></label
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
          <h2
            id="published-slots"
            tabindex="-1"
            ${focusSection(p.focusSection === "published-slots")}
          >
            Manage published slots
          </h2>
          <label
            >Published date<input
              type="date"
              value=${state.publishedDate}
              data-intent=${i.PublishedDate} /></label
          >${!state.publishedDate
            ? html`<p class="muted">
                Choose a date to inspect, edit or unpublish its slots.
              </p>`
            : nothing}
          <div class="cards">
            ${s.slots
              .filter((slot) => slot.date === state.publishedDate)
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
                              data-intent=${i.EditSlot}
                              data-id=${slot.id}
                              data-form-key=${`edit_slot-${slot.id}`}
                              ${formErrors(
                                p.errorForm === `edit_slot-${slot.id}`
                                  ? p.issues
                                  : noIssues,
                              )}
                            >
                              <fieldset ?disabled=${p.busy}>
                                <label
                                  >Date<input
                                    name="date"
                                    type="date"
                                    value=${slot.date}
                                    required /></label
                                ><label
                                  >Starts<input
                                    name="start"
                                    type="time"
                                    value=${slot.start}
                                    required /></label
                                ><label
                                  >Ends<input
                                    name="end"
                                    type="time"
                                    value=${slot.end}
                                    required /></label
                                >${spaceField(g.split, slot.space)}<button>
                                  Save slot
                                </button>
                              </fieldset>
                            </form>
                          </details>
                          <button
                            ?disabled=${p.busy}
                            data-intent=${i.SlotEnabled}
                            data-id=${slot.id}
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
            <h2
              id="closures"
              tabindex="-1"
              ${focusSection(p.focusSection === "closures")}
            >
              Gym unavailable
            </h2>
            <gymtime-help-tip topic="closures"></gymtime-help-tip>
          </div>
          <p class="muted">
            A closure cancels every affected confirmed booking and pending
            request. Coaches receive the reason. Cancelled bookings stay in
            history; reopening time does not restore them.
          </p>
          <form
            data-intent=${i.CloseGym}
            data-form-key=${"close_gym"}
            ${formErrors(p.errorForm === "close_gym" ? p.issues : noIssues)}
          >
            <fieldset ?disabled=${p.busy}>
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
                        ?disabled=${p.busy}
                        data-intent=${i.ReopenGym}
                        data-id=${c.id}
                      >
                        Reopen time
                      </button>`
                    : html``}
                </li>`,
            )}
          </ul>
        </section>`;
    },
  },
);
