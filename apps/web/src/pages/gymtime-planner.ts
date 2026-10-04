import { consume } from "@lit/context";
import { Task, TaskStatus } from "@lit/task";
import { Either } from "effect";
import { LitElement, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { ApiFailure, type Session } from "../domain/api.js";
import type { AppAdapter } from "../runtime/adapter.js";
import { adapterContext } from "../state/context.js";
import {
  type Schedule,
  type ScheduleAction,
  type Booking,
  type Preview,
  Request,
  spaceLabel,
  dateLabel,
  shiftDate,
  monday,
  instantLabel,
  slotsConflict,
} from "../domain/schedule.js";
import { Revalidate } from "../components/revalidate.js";
import { FormErrors } from "../components/form-errors.js";
import { plannerStyles } from "../components/planner-styles.js";
import {
  type ActionEvent,
  formValues,
  text,
  number,
  activityField,
  activityInput,
  noteField,
  scopeField,
  scopeInput,
  slotLabel,
} from "../components/planner-forms.js";
import {
  reviewGroups,
  shortTeam,
  timeRange,
  pendingAt,
  weeklyPatterns,
} from "../domain/schedule-views.js";
import "../components/gymtime-calendar.js";
import "../components/gymtime-help-tip.js";
import "../components/gymtime-guide.js";
import {
  initialGuidance,
  type GuidancePreferences,
  type HelpDestination,
} from "../domain/guidance.js";
import "./gymtime-setup.js";
import "./gymtime-accounts.js";
import "./gymtime-inbox.js";
@customElement("gymtime-planner")
export class GymtimePlanner extends LitElement {
  @consume({ context: adapterContext })
  @property({ attribute: false })
  adapter?: AppAdapter;
  @property({ attribute: false }) session?: Session;
  @state() private current: Schedule | undefined;
  @state() private tab:
    | "calendar"
    | "finder"
    | "requests"
    | "history"
    | "swaps"
    | "setup"
    | "people"
    | "inbox"
    | "sharing"
    | "help" = "calendar";
  @state() private helpPreferences: GuidancePreferences = initialGuidance;
  @state() private helpWarning = "";
  @state() private walkthrough = -1;
  private readonly guidanceLoad = new Task(this, {
    args: () => [this.adapter, this.session?.user_id] as const,
    task: ([adapter, user], { signal }) => {
      this.helpPreferences = initialGuidance;
      this.helpWarning = "";
      return adapter && user
        ? adapter.guidance(user, signal).then((result) => {
            if (Either.isRight(result)) this.helpPreferences = result.right;
            else this.helpWarning = result.left.message;
          })
        : Promise.resolve();
    },
  });
  private readonly guidanceSave = new Task(this, {
    autoRun: false,
    args: () =>
      [this.adapter, this.session?.user_id, this.helpPreferences] as const,
    task: ([adapter, user, value], { signal }) =>
      adapter && user
        ? adapter.saveGuidance(user, value, signal).then((result) => {
            this.helpWarning = Either.isLeft(result) ? result.left.message : "";
          })
        : Promise.resolve(),
  });
  private changeGuidance(event: CustomEvent<GuidancePreferences>) {
    this.helpPreferences = event.detail;
    void this.guidanceSave.run();
  }
  private guide(s: Schedule, compact = false) {
    return html`<gymtime-guide
      .schedule=${s}
      .session=${this.session}
      .season=${this.season}
      .preferences=${this.helpPreferences}
      .compact=${compact}
      @help-open=${() => {
        this.tab = "help";
      }}
      @help-preferences=${this.changeGuidance}
      @help-go=${(event: CustomEvent<HelpDestination>) => {
        const destination = event.detail;
        if (
          ["gym-setup", "seasons", "team-setup", "closures", "slots"].includes(
            destination,
          )
        )
          this.openSetup(destination);
        else {
          this.tab =
            destination === "sharing"
              ? "sharing"
              : destination === "requests"
                ? "requests"
                : destination === "swaps"
                  ? "swaps"
                  : destination === "inbox"
                    ? "inbox"
                    : destination === "finder"
                      ? "finder"
                      : "calendar";
          if (destination === "finder") this.walkthrough = 0;
        }
      }}
    ></gymtime-guide>`;
  }
  @state() private season = 0;
  @state() private week = "";
  @state() private teamFilter = 0;
  @state() private spaceFilter = "all";
  @state() private day = "";
  @state() private finderEnd = "";
  @state() private selectedTeam = 0;
  @state() private activeBooking = 0;
  @state() private activeSlot = 0;
  @state() private historyPage = 0;
  @state() private historySearch = "";
  @state() private historyStatus = "all";
  @state() private historyKind = "bookings";
  @state() private requestTeam = 0;
  @state() private requestType = "all";
  @state() private requestDate = "";
  @state() private competingOnly = false;
  @state() private swapHistory = false;
  @state() private selectionOpen = false;
  @state() private setupSection = "";
  @state() private editDates: Readonly<Record<string, string>> = {};
  @state() private swapDate = "";
  @state() private bookingMode = "direct";
  @state() private selectionDraft: {
    readonly note: string;
    readonly reason: string;
    readonly activity: "practice" | "game";
    readonly scope: "one" | "future" | "remaining";
  } = { note: "", reason: "", activity: "practice", scope: "one" };
  private reviewOrigin = false;
  private resetDraft() {
    this.selectionDraft = {
      note: "",
      reason: "",
      activity: "practice",
      scope: "one",
    };
  }
  private rememberSelection(event: Event) {
    if (event.currentTarget instanceof HTMLFormElement) {
      const form = new FormData(event.currentTarget);
      this.selectionDraft = {
        note: text(form, "note"),
        reason: form.has("reason")
          ? text(form, "reason")
          : this.selectionDraft.reason,
        activity: activityInput(form),
        scope: scopeInput(form),
      };
    }
  }

  @state() private selected: ReadonlyArray<number> = [];
  @state() private excluded: ReadonlyArray<{
    readonly date: string;
    readonly reason: string;
  }> = [];
  @state() private decisions: ReadonlyArray<number> = [];
  @state() private edit: Booking | undefined;
  @state() private pending: ScheduleAction | undefined;
  @state() private retryKey = "";
  @state() private confirmation = "";
  @state() private previewValue: Preview | undefined;
  @state() private message = "";
  @state() private failure: ApiFailure | undefined;
  @state() private openedBookingForms: ReadonlySet<string> = new Set();
  private readonly revalidation = new Revalidate(this, () => {
    if (!this.busy && this.load.status !== TaskStatus.PENDING)
      void this.load.run();
  });
  private readonly errors = new FormErrors(
    this,
    () => this.failure?.issues ?? [],
  );
  private readonly load = new Task(this, {
    args: () => [this.adapter, this.session] as const,
    task: ([adapter], { signal }) =>
      adapter
        ? adapter.schedule(signal).then((result) => {
            if (Either.isRight(result)) {
              this.current = result.right;
              this.initialFilters(result.right);
            } else if (this.current) {
              this.failure = result.left;
            }
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
  private readonly save = new Task(this, {
    autoRun: false,
    args: () => [this.adapter, this.session, this.pending] as const,
    task: ([adapter, session, action], { signal }) => {
      if (!adapter || !session || !action) return Promise.resolve(undefined);
      this.failure = undefined;
      this.message = "";
      return adapter
        .save(action, this.retryKey, session.csrf_token, signal)
        .then((prepared) => {
          if (Either.isLeft(prepared)) {
            this.failure = prepared.left;
            return;
          }
          this.retryKey = prepared.right.key;
          const result = prepared.right.result;
          if (Either.isLeft(result)) {
            this.failure = result.left;
            return;
          }
          this.current = result.right.schedule;
          if (action.operation === "create_season")
            this.season =
              result.right.outcome.resources.find(
                (resource) => resource.kind === "season",
              )?.id ?? this.season;
          this.initialFilters(result.right.schedule);
          this.message = result.right.outcome.warnings.includes("coach_overlap")
            ? "Saved. This primary coach has overlapping team bookings in different gym spaces."
            : result.right.outcome.warnings.includes("some_dates_unavailable")
              ? "Saved. Some requested dates were cancelled because another approved booking uses that space and time."
              : this.savedMessage(action);
          this.selected = [];
          this.excluded = [];
          this.decisions = [];
          this.edit = undefined;
          this.selectionOpen = false;
          this.resetDraft();
          this.reviewOrigin = false;
          this.activeBooking = 0;
          this.pending = undefined;
          this.retryKey = "";
          return result;
        });
    },
  });
  private readonly preview = new Task(this, {
    autoRun: false,
    args: () => [this.adapter, this.pending] as const,
    task: ([adapter, action], { signal }) =>
      adapter && action
        ? adapter.preview(action, signal).then((result) => {
            if (Either.isLeft(result)) this.failure = result.left;
            else {
              this.previewValue = result.right;
              void this.openDialog();
            }
            return result;
          })
        : Promise.resolve(undefined),
  });
  static override styles = plannerStyles;
  private get busy() {
    return (
      this.save.status === TaskStatus.PENDING ||
      this.preview.status === TaskStatus.PENDING
    );
  }
  private initialFilters(s: Schedule) {
    if (!this.season)
      this.season =
        s.seasons.find((v) => v.status === "active")?.id ??
        s.seasons[0]?.id ??
        0;
    if (!this.week) {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: s.gym.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(s.now);
      this.week = monday(today);
      this.day = today;
      this.finderEnd = shiftDate(today, 6);
      if (!this.session?.organizer) this.teamFilter = -1;
      this.selectedTeam =
        s.teams.find(
          (team) =>
            this.manageable(team.id) && team.seasons.includes(this.season),
        )?.id ?? 0;
    }
    if (
      !s.teams.some(
        (team) =>
          team.id === this.selectedTeam &&
          this.manageable(team.id) &&
          team.seasons.includes(this.season),
      )
    )
      this.selectedTeam =
        s.teams.find(
          (team) =>
            this.manageable(team.id) && team.seasons.includes(this.season),
        )?.id ?? 0;
  }
  private manageable(teamId: number) {
    const team = this.current?.teams.find((t) => t.id === teamId);
    return Boolean(
      team &&
        this.session &&
        (this.session.organizer || team.primary === this.session.user_id),
    );
  }
  private teamName(id: number) {
    return this.current?.teams.find((t) => t.id === id)?.name ?? "Team";
  }
  private describeBooking(b: Booking) {
    const slot = this.current?.slots.find((slot) => slot.id === b.slot);
    return `${this.teamName(b.team)} · ${slot ? slotLabel(slot) : "Unknown time"}`;
  }
  private submit(
    event: SubmitEvent,
    make: (f: FormData) => ScheduleAction,
    confirmation = "",
  ) {
    this.errors.remember(event);
    const f = formValues(event);
    if (f) this.start(make(f), confirmation);
  }
  private start(action: ScheduleAction, confirmation = "") {
    if (this.busy) return;
    this.reviewOrigin = Boolean(
      this.renderRoot.querySelector<HTMLDialogElement>("#selection-dialog")
        ?.open,
    );
    this.renderRoot
      .querySelector<HTMLDialogElement>("#booking-dialog")
      ?.close();
    this.renderRoot
      .querySelector<HTMLDialogElement>("#selection-dialog")
      ?.close();
    this.pending = action;
    this.retryKey = "";
    this.failure = undefined;
    this.previewValue = undefined;
    this.confirmation = confirmation;
    if (confirmation) void this.openDialog();
    else void this.save.run();
  }
  private handleAction(event: ActionEvent) {
    event.stopPropagation();
    if (this.busy) return;
    this.pending = event.detail.action;
    this.retryKey = "";
    this.failure = undefined;
    this.previewValue = undefined;
    this.confirmation = event.detail.confirmation ?? "";
    if (event.detail.preview) void this.preview.run();
    else if (this.confirmation) void this.openDialog();
    else void this.save.run();
  }
  private openDialog() {
    return this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLDialogElement>("#confirm-dialog")
        ?.showModal(),
    );
  }
  private dismiss() {
    this.renderRoot
      .querySelector<HTMLDialogElement>("#confirm-dialog")
      ?.close();
    this.pending = undefined;
    this.previewValue = undefined;
    this.confirmation = "";
    if (this.reviewOrigin) {
      this.reviewOrigin = false;
      void this.openSelection();
    }
  }
  private confirm() {
    this.renderRoot
      .querySelector<HTMLDialogElement>("#confirm-dialog")
      ?.close();
    void this.save.run();
  }
  private toggleSlot(id: number) {
    this.excluded = [];
    const slot = this.current?.slots.find((slot) => slot.id === id);
    if (!slot) return;
    this.selected = this.selected.includes(id)
      ? this.selected.filter((v) => v !== id)
      : [
          ...this.selected.filter(
            (otherId) =>
              !this.current?.slots.some(
                (other) => other.id === otherId && slotsConflict(slot, other),
              ),
          ),
          id,
        ];
  }
  private toggleDecision(id: number) {
    this.decisions = this.decisions.includes(id)
      ? this.decisions.filter((v) => v !== id)
      : [...this.decisions, id];
  }
  private prepareBookingForm(event: Event, key: string) {
    if (
      event.currentTarget instanceof HTMLDetailsElement &&
      event.currentTarget.open &&
      !this.openedBookingForms.has(key)
    )
      this.openedBookingForms = new Set([...this.openedBookingForms, key]);
  }
  private decide(approve: boolean, ids: ReadonlyArray<number>) {
    const s = this.current;
    if (!s) return;
    this.start(
      {
        operation: "decide_requests",
        decisions: s.requests
          .filter((r) => ids.includes(r.id))
          .map((r) => ({ id: r.id, approve, version: r.version })),
      },
      `${approve ? "Approve" : "Decline"} ${ids.length} requested date(s)? Each date is checked again for conflicts. Approving a request cancels pending requests that use the same gym space and time.`,
    );
  }
  private selectChange(b: Booking) {
    this.edit = b;
    this.selectionDraft = {
      note: b.note,
      reason: "",
      activity: b.activity,
      scope: "one",
    };
    this.selected = [];
    this.tab = "finder";
    this.selectedTeam = b.team;
    this.renderRoot
      .querySelector<HTMLDialogElement>("#booking-dialog")
      ?.close();
    const slot = this.current?.slots.find((slot) => slot.id === b.slot);
    if (slot) {
      this.week = monday(slot.date);
      this.day = slot.date;
      this.finderEnd = shiftDate(slot.date, 6);
      this.season = slot.season;
    }
    this.message =
      "Choose replacement slots below, then submit the change. The original booking stays confirmed until approval.";
  }
  private withdrawRecurring(event: SubmitEvent, requestId: number) {
    const f = formValues(event);
    const s = this.current;
    const source = s?.requests.find((r) => r.id === requestId);
    if (!f || !s || !source) return;
    const scope = scopeInput(f);
    const from =
      s.slots.find((slot) => slot.id === source.slot)?.starts_at ?? 0;
    const ids = s.requests
      .filter((r) => {
        const slot = s.slots.find((slot) => slot.id === r.slot);
        return (
          r.status === "pending" &&
          r.team === source.team &&
          Boolean(slot && slot.ends_at > s.now) &&
          (r.id === source.id ||
            (source.series &&
              r.series === source.series &&
              scope !== "one" &&
              (scope === "remaining" ||
                Boolean(slot && slot.starts_at >= from))))
        );
      })
      .map((r) => r.id);
    this.start(
      { operation: "withdraw_requests", ids },
      `Withdraw ${ids.length} pending requested date(s)? Original confirmed bookings remain unchanged.`,
    );
  }
  private cancel(b: Booking, event: SubmitEvent) {
    const f = formValues(event);
    if (!f) return;
    this.start(
      {
        operation: "cancel_booking",
        id: b.id,
        scope: scopeInput(f),
        version: b.version,
      },
      `Cancel ${this.describeBooking(b)}? Scope: ${text(f, "scope")}. Completed dates stay in history. The released time becomes available immediately.`,
    );
  }
  private savedMessage(action: ScheduleAction) {
    switch (action.operation) {
      case "submit_requests":
      case "change_booking":
        return "Request sent · awaiting organizer approval.";
      case "decide_requests":
        return "Request decisions saved.";
      case "book_directly":
        return "Gym time assigned · coaches notified.";
      case "cancel_booking":
        return "Booking cancelled · released time is available.";
      case "propose_swap":
        return "Swap proposed · waiting for the other coach.";
      case "respond_swap":
        return action.accept
          ? "Swap accepted · both schedules updated."
          : "Swap declined · original bookings kept.";
      default:
        return "Schedule updated.";
    }
  }
  private mine(s: Schedule) {
    return s.teams
      .filter(
        (team) =>
          team.primary === this.session?.user_id ||
          team.assistants.includes(this.session?.user_id ?? 0),
      )
      .map((team) => team.id);
  }
  private calendar(s: Schedule) {
    return html`<section aria-labelledby="calendar-title">
      <div class="section-heading">
        <div>
          <div class="section-heading">
            <h2 id="calendar-title">
              ${this.teamFilter === -1 ? "My teams" : "Gym calendar"}
            </h2>
            <gymtime-help-tip topic="calendar"></gymtime-help-tip>
          </div>
          <p class="muted">
            ${s.seasons.find((season) => season.id === this.season)?.name}
          </p>
        </div>
        <div class="actions">
          ${s.seasons.some(
            (season) => season.id === this.season && season.status === "active",
          ) &&
          s.teams.some(
            (team) =>
              this.manageable(team.id) && team.seasons.includes(this.season),
          )
            ? html`<button
                class="primary"
                @click=${() => {
                  this.tab = "finder";
                }}
              >
                ${this.session?.organizer ? "Assign time" : "Find time"}
              </button>`
            : nothing}${this.session?.organizer
            ? html`<button @click=${() => this.openSetup("slots")}>
                  Publish time</button
                ><button @click=${() => this.openSetup("closures")}>
                  Block gym
                </button>`
            : nothing}
        </div>
      </div>
      <div class="toolbar calendar-filters">
        <label
          >View teams<select
            .value=${String(this.teamFilter)}
            @change=${(event: Event) => {
              if (event.currentTarget instanceof HTMLSelectElement)
                this.teamFilter = Number(event.currentTarget.value);
            }}
          >
            ${!this.session?.organizer
              ? html`<option value="-1">My teams</option>`
              : nothing}
            <option value="0">All gym</option>
            ${s.teams
              .filter((team) => team.seasons.includes(this.season))
              .map(
                (team) =>
                  html`<option value=${team.id}>
                    ${shortTeam(team.name)}
                  </option>`,
              )}
          </select></label
        ><label
          >Week containing<input
            type="date"
            .value=${this.day || this.week}
            @change=${(event: Event) => {
              if (
                event.currentTarget instanceof HTMLInputElement &&
                event.currentTarget.value
              ) {
                this.day = event.currentTarget.value;
                this.week = monday(this.day);
              }
            }} /></label
        ><button
          ?disabled=${this.load.status === TaskStatus.PENDING || this.busy}
          @click=${() => this.load.run()}
        >
          Refresh schedule
        </button>
      </div>
      <gymtime-calendar
        .schedule=${s}
        .season=${this.season}
        .week=${this.week}
        .day=${this.day}
        .teams=${this.teamFilter === -1 ? this.mine(s) : [this.teamFilter]}
        .allTeams=${this.teamFilter === 0}
        .canSelect=${s.teams.some((team) => this.manageable(team.id))}
        .busy=${this.busy}
        @slot-open=${(event: CustomEvent<number>) => {
          this.activeSlot = event.detail;
          void this.updateComplete.then(() =>
            this.renderRoot
              .querySelector<HTMLDialogElement>("#slot-dialog")
              ?.showModal(),
          );
        }}
        @booking-open=${(event: CustomEvent<number>) =>
          this.openBooking(event.detail)}
        @time-open=${(event: CustomEvent<number>) => {
          const slot = s.slots.find((slot) => slot.id === event.detail);
          if (slot) {
            this.day = slot.date;
            this.finderEnd = slot.date;
            this.spaceFilter = slot.space;
            this.toggleSlot(slot.id);
            this.tab = "finder";
          }
        }}
        @day-open=${(event: CustomEvent<string>) => {
          this.day = event.detail;
        }}
        @week-shift=${(event: CustomEvent<number>) => {
          this.day = shiftDate(this.day || this.week, event.detail);
          this.week = monday(this.day);
        }}
        @today-open=${() => {
          this.day = new Intl.DateTimeFormat("en-CA", {
            timeZone: s.gym.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(s.now);
          this.week = monday(this.day);
        }}
      ></gymtime-calendar>
    </section>`;
  }
  private openSetup(id: string) {
    this.setupSection = id;
    this.tab = "setup";
  }
  private openBooking(id: number) {
    this.activeBooking = id;
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLDialogElement>("#booking-dialog")
        ?.showModal(),
    );
  }
  private openSelection() {
    this.selectionOpen = true;
    void this.updateComplete.then(() =>
      this.renderRoot
        .querySelector<HTMLDialogElement>("#selection-dialog")
        ?.showModal(),
    );
  }
  private finder(s: Schedule) {
    const end = this.finderEnd >= this.day ? this.finderEnd : this.day;
    const choices = s.slots
      .filter(
        (slot) =>
          slot.season === this.season &&
          (slot.available || slot.id === this.edit?.slot) &&
          slot.ends_at > s.now &&
          slot.date >= this.day &&
          slot.date <= end &&
          (this.spaceFilter === "all" || slot.space === this.spaceFilter),
      )
      .sort(
        (a, b) => a.starts_at - b.starts_at || a.space.localeCompare(b.space),
      );
    const dates = [...new Set(choices.map((slot) => slot.date))];
    return html`<section aria-labelledby="finder-title">
      <div class="section-heading">
        <div>
          <h2 id="finder-title">
            ${this.edit
              ? "Choose replacement time"
              : this.session?.organizer
                ? "Assign gym time"
                : "Find gym time"}
          </h2>
          <p class="muted">
            Choose published times. Selections stay while you browse other
            dates.
          </p>
        </div>
        <button
          @click=${() => {
            this.tab = "calendar";
          }}
        >
          Back to calendar
        </button>
      </div>
      <gymtime-help-tip topic="finder"></gymtime-help-tip>
      ${this.walkthrough >= 0
        ? html`<aside class="info-box" aria-labelledby="walkthrough-title">
            <div class="section-heading">
              <h3 id="walkthrough-title">
                Request time · Step ${this.walkthrough + 1} of 3
              </h3>
              <button
                @click=${() => {
                  this.walkthrough = -1;
                }}
              >
                Close walkthrough
              </button>
            </div>
            <p>
              ${[
                "Choose your team and date range below. Select the published times you want. Pending requests do not reserve a slot; a competing request needs your reason.",
                "Review your selected times in the side panel or use Review selection on mobile. For a weekly pattern, open Repeat weekly and review all excluded dates. Notes stay internal.",
                "Check the team, dates, space, and activity, then send your request when ready. The organizer must approve it. This walkthrough does not send anything for you.",
              ][this.walkthrough]}
            </p>
            <div class="actions">
              ${this.walkthrough > 0
                ? html`<button
                    @click=${() => {
                      this.walkthrough -= 1;
                    }}
                  >
                    Previous tip
                  </button>`
                : nothing}<button
                @click=${() => {
                  this.walkthrough =
                    this.walkthrough === 2 ? -1 : this.walkthrough + 1;
                }}
              >
                ${this.walkthrough === 2 ? "Finish walkthrough" : "Next tip"}
              </button>
            </div>
          </aside>`
        : nothing}
      <div class="finder-layout">
        <div>
          <div class="fields finder-filters">
            <label
              >Team<select
                .value=${String(this.selectedTeam)}
                @change=${(event: Event) => {
                  if (event.currentTarget instanceof HTMLSelectElement)
                    this.selectedTeam = Number(event.currentTarget.value);
                }}
                ?disabled=${Boolean(this.edit)}
              >
                ${s.teams
                  .filter(
                    (team) =>
                      this.manageable(team.id) &&
                      team.seasons.includes(this.season),
                  )
                  .map(
                    (team) =>
                      html`<option value=${team.id}>
                        ${shortTeam(team.name)}
                      </option>`,
                  )}
              </select></label
            ><label
              >From date<input
                type="date"
                .value=${this.day}
                @change=${(event: Event) => {
                  if (
                    event.currentTarget instanceof HTMLInputElement &&
                    event.currentTarget.value
                  ) {
                    this.day = event.currentTarget.value;
                    if (this.finderEnd < this.day)
                      this.finderEnd = shiftDate(this.day, 6);
                  }
                }} /></label
            ><label
              >Through date<input
                type="date"
                min=${this.day}
                .value=${end}
                @change=${(event: Event) => {
                  if (
                    event.currentTarget instanceof HTMLInputElement &&
                    event.currentTarget.value
                  )
                    this.finderEnd = event.currentTarget.value;
                }} /></label
            ><label
              >Space filter<select
                .value=${this.spaceFilter}
                @change=${(event: Event) => {
                  if (event.currentTarget instanceof HTMLSelectElement)
                    this.spaceFilter = event.currentTarget.value;
                }}
              >
                <option value="all">All spaces</option>
                <option value="full">Full gym</option>
                ${s.gym.split
                  ? html`<option value="half_a">Half A</option>
                      <option value="half_b">Half B</option>`
                  : nothing}
              </select></label
            >
          </div>
          <p class="muted small">
            ${choices.length} available times · All times use ${s.gym.timezone}
          </p>
          <div class="availability-list">
            ${dates.slice(0, 14).map(
              (date) =>
                html`<section
                  class="availability-day"
                  aria-label=${dateLabel(date)}
                >
                  <h3>${dateLabel(date)}</h3>
                  <div class="time-choices">
                    ${choices
                      .filter((slot) => slot.date === date)
                      .map(
                        (slot) =>
                          html`<button
                            class="time-choice"
                            aria-pressed=${this.selected.includes(slot.id)}
                            aria-label=${`Select ${slotLabel(slot)}`}
                            ?disabled=${this.busy}
                            @click=${() => this.toggleSlot(slot.id)}
                          >
                            <strong>${timeRange(slot)}</strong
                            ><span>${spaceLabel(slot.space)}</span
                            ><small
                              >${this.selected.includes(slot.id)
                                ? "Selected"
                                : pendingAt(s, slot).length
                                  ? "Available · request pending"
                                  : "Available"}</small
                            >
                          </button>`,
                      )}
                  </div>
                </section>`,
            )}
          </div>
          ${dates.length > 14
            ? html`<p>
                Showing the first 14 available days. Narrow the date range to
                reach later dates; use Repeat weekly for a season pattern.
              </p>`
            : nothing}${!choices.length
            ? html`<p class="status">
                No published available times match these filters. Try another
                date or space.
              </p>`
            : nothing}
        </div>
        <div class="desktop-selection">${this.requestForm(s)}</div>
      </div>
    </section>`;
  }
  private selectWeekly(event: SubmitEvent, s: Schedule) {
    const f = formValues(event);
    if (f && this.selected.length) {
      const value = weeklyPatterns(s, this.selected, text(f, "until"));
      this.selected = value.slots;
      this.excluded = value.excluded;
    }
  }
  private requestForm(s: Schedule, context: "desktop" | "dialog" = "desktop") {
    const edit = this.edit;
    const anchors = s.slots.filter((slot) => this.selected.includes(slot.id));
    const season = s.seasons.find((season) => season.id === this.season);
    const competitors = s.requests.filter(
      (request) =>
        request.status === "pending" &&
        s.slots.some(
          (other) =>
            other.id === request.slot &&
            anchors.some((anchor) => slotsConflict(anchor, other)),
        ),
    );
    return html`<aside
      class="card selection-card"
      aria-labelledby=${`selection-title-${context}`}
    >
      <h3 id=${`selection-title-${context}`}>
        ${edit ? "Request a booking change" : "Review selection"}
      </h3>
      <p>
        <strong>${this.selected.length} times selected</strong> ·
        ${shortTeam(this.teamName(edit?.team ?? this.selectedTeam))}
      </p>
      <p class="small muted">
        ${[
          ...new Set(
            anchors.map(
              (slot) =>
                `${new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${slot.date}T12:00:00Z`))} ${timeRange(slot)} · ${spaceLabel(slot.space)}`,
            ),
          ),
        ].join("; ")}
      </p>
      ${edit
        ? html`<p class="status small">
            Current: ${this.describeBooking(edit)}. Original stays confirmed
            until approval.
          </p>`
        : nothing}${this.selected.length
        ? html`<details class="selected-dates">
            <summary>Selected dates · ${this.selected.length}</summary>
            <ul>
              ${anchors.map(
                (slot) =>
                  html`<li>
                    ${slotLabel(slot)}
                    <button
                      type="button"
                      aria-label=${`Remove ${slotLabel(slot)}`}
                      @click=${() => this.toggleSlot(slot.id)}
                    >
                      Remove
                    </button>
                  </li>`,
              )}
            </ul>
          </details>`
        : html`<p class="muted">Select a time to get started.</p>`}
      ${this.selected.length && season
        ? html`<details class="repeat-weekly">
            <summary>Repeat weekly</summary>
            <gymtime-help-tip topic="recurring"></gymtime-help-tip>
            <p class="small">
              Repeat every selected weekday, time, and space. Missing or
              unavailable dates are excluded.
            </p>
            <form
              @submit=${(event: SubmitEvent) => this.selectWeekly(event, s)}
            >
              <label
                >Repeat through<input
                  name="until"
                  type="date"
                  required
                  min=${anchors[0]?.date ?? season.start_date}
                  max=${season.end_date}
                  .value=${season.end_date} /></label
              ><button>Select matching weekly slots</button>
            </form>
          </details>`
        : nothing}
      ${this.excluded.length
        ? html`<details>
            <summary>
              ${this.excluded.length} excluded
              ${this.excluded.length === 1 ? "date" : "dates"} · Review
              exceptions
            </summary>
            <ul>
              ${this.excluded.map(
                (excluded) =>
                  html`<li>
                    ${dateLabel(excluded.date)}: ${excluded.reason}
                  </li>`,
              )}
            </ul>
          </details>`
        : nothing}
      <form
        @input=${this.rememberSelection}
        @change=${this.rememberSelection}
        @submit=${(event: SubmitEvent) =>
          this.submit(
            event,
            (form) =>
              edit
                ? {
                    operation: "change_booking",
                    id: edit.id,
                    scope: scopeInput(form),
                    slots: [...this.selected],
                    activity: activityInput(form),
                    note: text(form, "note"),
                    reason: text(form, "reason"),
                    version: edit.version,
                  }
                : text(form, "mode") === "direct" && this.session?.organizer
                  ? {
                      operation: "book_directly",
                      team: this.selectedTeam,
                      slots: [...this.selected],
                      activity: activityInput(form),
                      note: text(form, "note"),
                    }
                  : {
                      operation: "submit_requests",
                      team: this.selectedTeam,
                      slots: [...this.selected],
                      activity: activityInput(form),
                      note: text(form, "note"),
                      reason: text(form, "reason"),
                    },
            `Submit ${this.selected.length} selected date(s)? ${edit ? "Existing bookings remain confirmed until the organizer approves each change." : "Each selected date will be checked for conflicts."}`,
          )}
      >
        <fieldset ?disabled=${this.busy || !this.selected.length}>
          <div class="fields">
            ${edit
              ? scopeField(edit.series, this.selectionDraft.scope)
              : nothing}${activityField(this.selectionDraft.activity)}${this
              .session?.organizer && !edit
              ? html`<label
                  >Booking method<select
                    name="mode"
                    .value=${this.bookingMode}
                    @change=${(event: Event) => {
                      if (event.currentTarget instanceof HTMLSelectElement)
                        this.bookingMode = event.currentTarget.value;
                    }}
                  >
                    <option value="direct">Confirm directly</option>
                    <option value="request">Submit for approval</option>
                  </select></label
                >`
              : nothing}
          </div>
          <details>
            <summary>Add a note</summary>
            ${noteField(this.selectionDraft.note)}
          </details>
          ${competitors.length
            ? html`<div class="status small">
                <p>
                  Another request is pending:
                  ${[
                    ...new Set(
                      competitors.map((request) =>
                        shortTeam(this.teamName(request.team)),
                      ),
                    ),
                  ].join(", ")}.
                  These times remain available.
                </p>
                ${this.session?.organizer &&
                !edit &&
                this.bookingMode === "direct"
                  ? html`<p>
                      Assigning these times cancels competing pending requests.
                    </p>`
                  : html`<label
                      >Competing request reason<textarea
                        name="reason"
                        .value=${this.selectionDraft.reason}
                        required
                        maxlength="2000"
                      ></textarea>
                    </label>`}
              </div>`
            : nothing}
          <div class="actions">
            <button class="primary">
              ${edit
                ? "Submit change request"
                : this.session?.organizer
                  ? "Assign selected times"
                  : "Submit selected dates"}
            </button>
          </div>
        </fieldset>
      </form>
      ${this.selected.length || edit
        ? html`<button
            type="button"
            @click=${() => {
              this.selected = [];
              this.excluded = [];
              this.edit = undefined;
              this.resetDraft();
            }}
          >
            Clear selection
          </button>`
        : nothing}
    </aside>`;
  }
  private bookingCard(b: Booking, s: Schedule) {
    const slot = s.slots.find((slot) => slot.id === b.slot);
    const canChange =
      this.manageable(b.team) &&
      b.status === "confirmed" &&
      Boolean(
        slot &&
          slot.ends_at > s.now &&
          s.seasons.find((v) => v.id === slot.season)?.status === "active",
      );
    return html`<article class="card">
      <h3>${this.teamName(b.team)}</h3>
      <p>${slot ? slotLabel(slot) : "Unknown slot"} · ${b.activity}</p>
      <span class="badge">${b.status.replaceAll("_", " ")}</span>${b.series
        ? html`<span class="muted">Recurring booking</span>`
        : nothing}${b.note ? html`<p>${b.note}</p>` : nothing}${canChange
        ? html`<div class="actions">
              <button
                ?disabled=${this.busy}
                @click=${() => this.selectChange(b)}
              >
                Request change
              </button>
            </div>
            <details>
              <summary>Cancel booking</summary>
              <form @submit=${(e: SubmitEvent) => this.cancel(b, e)}>
                <fieldset ?disabled=${this.busy}>
                  ${scopeField(b.series)}<button>Cancel selected dates</button>
                </fieldset>
              </form>
            </details>
            ${this.session?.organizer
              ? html`<details
                  @toggle=${(event: Event) =>
                    this.prepareBookingForm(event, `move-${b.id}`)}
                >
                  <summary>Organizer: change booking directly</summary>
                  ${this.openedBookingForms.has(`move-${b.id}`)
                    ? html`<form
                        @submit=${(e: SubmitEvent) =>
                          this.submit(
                            e,
                            (f) => ({
                              operation: "move_booking",
                              id: b.id,
                              slot: number(f, "slot"),
                              activity: activityInput(f),
                              note: text(f, "note"),
                              version: b.version,
                            }),
                            "Change this confirmed booking? Affected coaches and parent calendars will receive the new time.",
                          )}
                      >
                        <fieldset ?disabled=${this.busy}>
                          <label
                            >Replacement date<input
                              type="date"
                              .value=${this.editDates[`booking-${b.id}`] ??
                              slot?.date ??
                              ""}
                              @change=${(event: Event) => {
                                if (
                                  event.currentTarget instanceof
                                    HTMLInputElement &&
                                  event.currentTarget.value
                                )
                                  this.editDates = {
                                    ...this.editDates,
                                    [`booking-${b.id}`]:
                                      event.currentTarget.value,
                                  };
                              }} /></label
                          ><label
                            >Replacement slot<select name="slot" required>
                              ${s.slots
                                .filter(
                                  (slot) =>
                                    slot.season === this.season &&
                                    slot.date ===
                                      (this.editDates[`booking-${b.id}`] ??
                                        s.slots.find(
                                          (source) => source.id === b.slot,
                                        )?.date) &&
                                    slot.ends_at > s.now &&
                                    (slot.available || slot.id === b.slot),
                                )
                                .map(
                                  (slot) =>
                                    html`<option
                                      value=${slot.id}
                                      ?selected=${slot.id === b.slot}
                                    >
                                      ${slotLabel(slot)}
                                    </option>`,
                                )}
                            </select></label
                          >${activityField(b.activity)}${noteField(
                            b.note,
                          )}<button>Save booking change</button>
                        </fieldset>
                      </form>`
                    : nothing}
                </details>`
              : nothing}${s.teams.find((t) => t.id === b.team)?.primary ===
              this.session?.user_id && Boolean(slot && slot.starts_at > s.now)
              ? html`<details
                  @toggle=${(event: Event) =>
                    this.prepareBookingForm(event, `swap-${b.id}`)}
                >
                  <summary>Propose a swap</summary>
                  ${this.openedBookingForms.has(`swap-${b.id}`)
                    ? html`<form
                        @submit=${(e: SubmitEvent) =>
                          this.submit(
                            e,
                            (f) => {
                              const target = s.bookings.find(
                                (v) => v.id === number(f, "second"),
                              );
                              return {
                                operation: "propose_swap",
                                first: b.id,
                                first_version: b.version,
                                second: number(f, "second"),
                                second_version: target?.version ?? 0,
                              };
                            },
                            "Propose this exchange? Both original bookings stay confirmed. The other team's primary coach must accept before the earlier booking starts.",
                          )}
                      >
                        <fieldset ?disabled=${this.busy}>
                          <label
                            >Swap date (optional)<input
                              type="date"
                              .value=${this.swapDate}
                              @change=${(event: Event) => {
                                if (
                                  event.currentTarget instanceof
                                  HTMLInputElement
                                )
                                  this.swapDate = event.currentTarget.value;
                              }} /></label
                          ><label
                            >Swap with confirmed booking<select
                              name="second"
                              required
                            >
                              ${s.bookings
                                .filter(
                                  (other) =>
                                    other.status === "confirmed" &&
                                    other.team !== b.team &&
                                    s.slots.some(
                                      (slot) =>
                                        slot.id === other.slot &&
                                        slot.starts_at > s.now &&
                                        slot.season === this.season &&
                                        (!this.swapDate ||
                                          slot.date === this.swapDate),
                                    ),
                                )
                                .map(
                                  (other) =>
                                    html`<option value=${other.id}>
                                      ${this.describeBooking(other)}
                                    </option>`,
                                )}
                            </select></label
                          ><button>Send swap proposal</button>
                        </fieldset>
                      </form>`
                    : nothing}
                </details>`
              : nothing}`
        : nothing}
    </article>`;
  }
  private requests(s: Schedule) {
    const pending = s.requests.filter(
      (request) =>
        request.status === "pending" &&
        s.slots.some(
          (slot) => slot.id === request.slot && slot.season === this.season,
        ),
    );
    const allGroups = reviewGroups(s, pending);
    const groups = allGroups.filter(
      (group) =>
        (!this.competingOnly || group.competing) &&
        group.requests.some(
          (request) =>
            (!this.requestTeam || request.team === this.requestTeam) &&
            (this.requestType === "all" ||
              (this.requestType === "change"
                ? Boolean(request.replacement)
                : !request.replacement)) &&
            (!this.requestDate ||
              s.slots.some(
                (slot) =>
                  slot.id === request.slot && slot.date === this.requestDate,
              )),
        ),
    );
    return html`<section aria-labelledby="request-title">
      <div class="section-heading">
        <div>
          <div class="section-heading">
            <h2 id="request-title">Needs review</h2>
            <gymtime-help-tip topic="requests"></gymtime-help-tip>
          </div>
          <p class="muted">
            ${allGroups.length} review items · ${pending.length} pending
            requests
          </p>
        </div>
        <button
          @click=${() => {
            this.tab = "history";
            this.historyKind = "requests";
            this.historyPage = 0;
          }}
        >
          Request history
        </button>
      </div>
      <details class="request-filters">
        <summary>
          Filter
          requests${this.requestTeam ||
          this.requestType !== "all" ||
          this.requestDate ||
          this.competingOnly
            ? " · Filters applied"
            : ""}
        </summary>
        <div class="fields">
          <label
            >Team filter<select
              .value=${String(this.requestTeam)}
              @change=${(event: Event) => {
                if (event.currentTarget instanceof HTMLSelectElement)
                  this.requestTeam = Number(event.currentTarget.value);
              }}
            >
              <option value="0">All teams</option>
              ${s.teams.map(
                (team) =>
                  html`<option value=${team.id}>
                    ${shortTeam(team.name)}
                  </option>`,
              )}
            </select></label
          ><label
            >Request type<select
              .value=${this.requestType}
              @change=${(event: Event) => {
                if (event.currentTarget instanceof HTMLSelectElement)
                  this.requestType = event.currentTarget.value;
              }}
            >
              <option value="all">All types</option>
              <option value="new">New time</option>
              <option value="change">Time change</option>
            </select></label
          ><label
            >Affected date<input
              type="date"
              .value=${this.requestDate}
              @change=${(event: Event) => {
                if (event.currentTarget instanceof HTMLInputElement)
                  this.requestDate = event.currentTarget.value;
              }} /></label
          ><label class="check"
            ><input
              type="checkbox"
              .checked=${this.competingOnly}
              @change=${() => {
                this.competingOnly = !this.competingOnly;
              }}
            />Competing only</label
          >
        </div>
        <button
          @click=${() => {
            this.requestTeam = 0;
            this.requestType = "all";
            this.requestDate = "";
            this.competingOnly = false;
          }}
        >
          Clear filters
        </button>
      </details>
      ${this.decisions.length
        ? html`<div class="decision-bar actions">
            <strong>${this.decisions.length} dates selected</strong
            ><button
              class="primary"
              ?disabled=${this.busy || this.decisionConflict(s)}
              @click=${() => this.decide(true, this.decisions)}
            >
              Approve selected dates</button
            ><button
              ?disabled=${this.busy}
              @click=${() => this.decide(false, this.decisions)}
            >
              Decline selected dates</button
            >${this.decisionConflict(s)
              ? html`<p>
                  Selected requests compete. Choose compatible dates before
                  approval.
                </p>`
              : nothing}
          </div>`
        : nothing}
      <div class="review-list">
        ${repeat(
          groups,
          (group) => group.key,
          (group) =>
            html`<details class="review-item">
              <summary>
                <span
                  ><strong
                    >${[
                      ...new Set(
                        group.requests.map((request) =>
                          shortTeam(this.teamName(request.team)),
                        ),
                      ),
                    ].join(" / ")}</strong
                  ><small
                    >${[
                      ...new Set(
                        group.requests.map((request) => {
                          const slot = s.slots.find(
                            (slot) => slot.id === request.slot,
                          );
                          return slot
                            ? `${timeRange(slot)} · ${spaceLabel(slot.space)}`
                            : "";
                        }),
                      ),
                    ].join(" / ")}</small
                  ><small
                    >${dateLabel(group.firstDate)}${group.requests.length > 1 &&
                    s.slots.find(
                      (slot) => slot.id === group.requests.at(-1)?.slot,
                    )?.date !== group.firstDate
                      ? ` – ${dateLabel(s.slots.find((slot) => slot.id === group.requests.at(-1)?.slot)?.date ?? group.firstDate)}`
                      : ""}
                    · ${group.requests.length}
                    ${group.requests.length === 1
                      ? "request"
                      : "requests"}</small
                  ></span
                ><span class="badge"
                  >${group.competing
                    ? "Competing"
                    : group.requests.some((request) => request.replacement)
                      ? "Time change"
                      : "New time"}</span
                ><span class="review-cta">Review dates</span>
              </summary>
              <div class="review-dates">
                ${!group.competing &&
                group.requests.length > 1 &&
                this.session?.organizer
                  ? html`<button
                      ?disabled=${this.busy}
                      @click=${() => {
                        this.decisions = [
                          ...new Set([
                            ...this.decisions,
                            ...group.requests.map((request) => request.id),
                          ]),
                        ];
                      }}
                    >
                      Select all dates in this group
                    </button>`
                  : nothing}
                ${group.competing
                  ? html`<p class="status small">
                      Compare these requests. Approving a date cancels
                      physically competing requests; compatible halves remain
                      available.
                    </p>`
                  : nothing}${group.requests.map((request) =>
                  this.requestDetail(request, s),
                )}
              </div>
            </details>`,
        )}
      </div>
      ${!groups.length
        ? html`<p class="status">
            ${pending.length
              ? "No requests match these filters."
              : "All caught up · no requests need review."}
          </p>`
        : nothing}
    </section>`;
  }
  private decisionConflict(s: Schedule) {
    const choices = s.requests.filter((request) =>
      this.decisions.includes(request.id),
    );
    return choices.some((first, index) =>
      choices
        .slice(index + 1)
        .some((second) =>
          s.slots.some(
            (a) =>
              a.id === first.slot &&
              s.slots.some((b) => b.id === second.slot && slotsConflict(a, b)),
          ),
        ),
    );
  }
  private requestDetail(r: typeof Request.Type, s: Schedule) {
    const slot = s.slots.find((slot) => slot.id === r.slot);
    const original = s.bookings.find((booking) => booking.id === r.replacement);
    const pending =
      r.status === "pending" &&
      Boolean(
        slot &&
          slot.ends_at > s.now &&
          s.seasons.find((season) => season.id === slot.season)?.status ===
            "active",
      );
    return html`<article class="request-date">
      <div>
        <h3>${shortTeam(this.teamName(r.team))}</h3>
        <p>${slot ? slotLabel(slot) : "Unknown time"} · ${r.activity}</p>
        ${original
          ? html`<p class="change-comparison">
              <strong>Current · confirmed:</strong> ${s.slots
                .filter((slot) => slot.id === original.slot)
                .map((slot) => slotLabel(slot))}<br /><strong
                >Requested →</strong
              >
              ${slot ? slotLabel(slot) : "Unknown time"}
            </p>`
          : nothing}<span class="badge">${r.status.replaceAll("_", " ")}</span
        >${r.note || r.reason
          ? html`<details>
              <summary>
                ${r.reason ? "Reason and note" : "Internal note"}
              </summary>
              ${r.reason ? html`<p>Reason: ${r.reason}</p>` : nothing}${r.note
                ? html`<p>${r.note}</p>`
                : nothing}
            </details>`
          : nothing}
      </div>
      ${pending && this.session?.organizer
        ? html`<div class="actions">
            <label class="check"
              ><input
                type="checkbox"
                .checked=${this.decisions.includes(r.id)}
                @change=${() => this.toggleDecision(r.id)}
                aria-label=${`Select request ${r.id} from ${this.teamName(r.team)}`}
              />Select date</label
            ><button
              class="primary"
              ?disabled=${this.busy}
              @click=${() => this.decide(true, [r.id])}
            >
              Approve date</button
            ><button
              ?disabled=${this.busy}
              @click=${() => this.decide(false, [r.id])}
            >
              Decline date
            </button>
          </div>`
        : nothing}${pending && this.manageable(r.team)
        ? html`<details>
            <summary>Manage request</summary>
            <details>
              <summary>Withdraw pending dates</summary>
              <form
                @submit=${(event: SubmitEvent) =>
                  this.withdrawRecurring(event, r.id)}
              >
                <fieldset ?disabled=${this.busy}>
                  ${scopeField(r.series)}<button>Withdraw request</button>
                </fieldset>
              </form>
            </details>
            <details>
              <summary>Edit pending request</summary>
              <form
                @submit=${(event: SubmitEvent) =>
                  this.submit(event, (form) => ({
                    operation: "edit_request",
                    id: r.id,
                    slot: number(form, "slot"),
                    activity: activityInput(form),
                    note: text(form, "note"),
                    reason: text(form, "reason"),
                    version: r.version,
                  }))}
              >
                <fieldset ?disabled=${this.busy}>
                  <label
                    >Requested date<input
                      type="date"
                      .value=${this.editDates[`request-${r.id}`] ??
                      slot?.date ??
                      ""}
                      @change=${(event: Event) => {
                        if (
                          event.currentTarget instanceof HTMLInputElement &&
                          event.currentTarget.value
                        )
                          this.editDates = {
                            ...this.editDates,
                            [`request-${r.id}`]: event.currentTarget.value,
                          };
                      }} /></label
                  ><label
                    >Requested slot<select name="slot" required>
                      ${s.slots
                        .filter(
                          (candidate) =>
                            candidate.season === this.season &&
                            candidate.date ===
                              (this.editDates[`request-${r.id}`] ??
                                slot?.date) &&
                            (candidate.available || candidate.id === r.slot) &&
                            candidate.ends_at > s.now,
                        )
                        .map(
                          (candidate) =>
                            html`<option
                              value=${candidate.id}
                              ?selected=${candidate.id === r.slot}
                            >
                              ${slotLabel(candidate)}
                            </option>`,
                        )}
                    </select></label
                  >${activityField(r.activity)}
                  <details>
                    <summary>Add a note</summary>
                    ${noteField(r.note)}
                  </details>
                  <label
                    >Competing reason<textarea
                      name="reason"
                      .value=${r.reason}
                      maxlength="2000"
                    ></textarea></label
                  ><button>Save pending request</button>
                </fieldset>
              </form>
            </details>
          </details>`
        : nothing}
    </article>`;
  }
  private history(s: Schedule) {
    const requests = this.historyKind === "requests";
    const matches = (record: Booking | typeof Request.Type) => {
      const slot = s.slots.find((slot) => slot.id === record.slot);
      return (
        slot?.season === this.season &&
        `${this.teamName(record.team)} ${slot.date} ${record.status} ${record.activity}`
          .toLowerCase()
          .includes(this.historySearch.toLowerCase())
      );
    };
    const completed = s.requests.filter(
      (request) =>
        request.status !== "pending" &&
        s.slots.some(
          (slot) => slot.id === request.slot && slot.season === this.season,
        ),
    );
    const groups = reviewGroups(s, completed)
      .filter((group) =>
        group.requests.some(
          (record) =>
            matches(record) &&
            (this.historyStatus === "all" ||
              record.status === this.historyStatus),
        ),
      )
      .reverse();
    const bookings = s.bookings
      .filter(
        (record) =>
          matches(record) &&
          (this.historyStatus === "all" ||
            record.status === this.historyStatus),
      )
      .sort(
        (a, b) =>
          (s.slots.find((slot) => slot.id === b.slot)?.starts_at ?? 0) -
          (s.slots.find((slot) => slot.id === a.slot)?.starts_at ?? 0),
      );
    const total = requests ? groups.length : bookings.length;
    const pages = Math.max(1, Math.ceil(total / 20));
    const page = Math.min(this.historyPage, pages - 1);
    return html`<section aria-labelledby="history-title">
      <div class="section-heading">
        <h2 id="history-title">Schedule history</h2>
        <gymtime-help-tip topic="history"></gymtime-help-tip>
      </div>
      <p class="muted">
        ${total} ${requests ? "request groups" : "bookings"} · 20 per page
      </p>
      <div class="fields">
        <label
          >History type<select
            .value=${this.historyKind}
            @change=${(event: Event) => {
              if (event.currentTarget instanceof HTMLSelectElement) {
                this.historyKind = event.currentTarget.value;
                this.historyStatus = "all";
                this.historyPage = 0;
              }
            }}
          >
            <option value="bookings">Bookings</option>
            <option value="requests">Completed requests</option>
          </select></label
        ><label
          >Search team, date or activity<input
            type="search"
            .value=${this.historySearch}
            @input=${(event: Event) => {
              if (event.currentTarget instanceof HTMLInputElement) {
                this.historySearch = event.currentTarget.value;
                this.historyPage = 0;
              }
            }} /></label
        ><label
          >Status filter<select
            .value=${this.historyStatus}
            @change=${(event: Event) => {
              if (event.currentTarget instanceof HTMLSelectElement) {
                this.historyStatus = event.currentTarget.value;
                this.historyPage = 0;
              }
            }}
          >
            <option value="all">All statuses</option>
            ${[
              ...new Set(
                (requests ? s.requests : s.bookings).map(
                  (record) => record.status,
                ),
              ),
            ]
              .filter((status) => !requests || status !== "pending")
              .map(
                (status) =>
                  html`<option value=${status}>
                    ${status.replaceAll("_", " ")}
                  </option>`,
              )}
          </select></label
        >
      </div>
      <div class="history-list">
        ${requests
          ? groups.slice(page * 20, page * 20 + 20).map(
              (group) =>
                html`<details class="review-item">
                  <summary>
                    <span
                      ><strong
                        >${[
                          ...new Set(
                            group.requests.map((request) =>
                              shortTeam(this.teamName(request.team)),
                            ),
                          ),
                        ].join(" / ")}</strong
                      ><small
                        >${dateLabel(group.firstDate)} ·
                        ${group.requests.length} dates</small
                      ></span
                    ><span class="badge"
                      >${[
                        ...new Set(
                          group.requests.map((request) => request.status),
                        ),
                      ].length > 1
                        ? "Mixed decisions"
                        : [
                            ...new Set(
                              group.requests.map((request) =>
                                request.status.replaceAll("_", " "),
                              ),
                            ),
                          ].join(", ")}</span
                    ><span class="review-cta">Review outcomes</span>
                  </summary>
                  <div class="review-dates">
                    ${group.requests.map((request) =>
                      this.requestDetail(request, s),
                    )}
                  </div>
                </details>`,
            )
          : bookings.slice(page * 20, page * 20 + 20).map((booking) => {
              const slot = s.slots.find((slot) => slot.id === booking.slot);
              return html`<div class="history-row">
                <span
                  ><strong>${shortTeam(this.teamName(booking.team))}</strong
                  ><small
                    >${slot ? slotLabel(slot) : "Unknown time"} ·
                    ${booking.activity}</small
                  ></span
                ><span class="badge"
                  >${booking.status.replaceAll("_", " ")}</span
                ><button @click=${() => this.openBooking(booking.id)}>
                  Booking details
                </button>
              </div>`;
            })}
      </div>
      <div class="actions">
        <button
          ?disabled=${page === 0}
          @click=${() => {
            this.historyPage = page - 1;
          }}
        >
          Previous page</button
        ><span>Page ${page + 1} of ${pages}</span
        ><button
          ?disabled=${page + 1 >= pages}
          @click=${() => {
            this.historyPage = page + 1;
          }}
        >
          Next page
        </button>
      </div>
      ${!total ? html`<p>No records match these filters.</p>` : nothing}
    </section>`;
  }
  private swaps(s: Schedule) {
    return html`<section aria-labelledby="swap-title">
      <div class="section-heading">
        <div>
          <div class="section-heading">
            <h2 id="swap-title">Swap proposals</h2>
            <gymtime-help-tip topic="changes"></gymtime-help-tip>
          </div>
          <p class="muted">
            Waiting for the other coach · originals stay confirmed
          </p>
        </div>
        <button
          @click=${() => {
            this.swapHistory = !this.swapHistory;
          }}
        >
          ${this.swapHistory ? "Pending swaps" : "Swap history"}
        </button>
      </div>
      <div class="cards">
        ${s.swaps
          .filter((swap) =>
            this.swapHistory
              ? swap.status !== "pending"
              : swap.status === "pending",
          )
          .filter((swap) =>
            s.bookings.some(
              (booking) =>
                (booking.id === swap.first || booking.id === swap.second) &&
                s.slots.some(
                  (slot) =>
                    slot.id === booking.slot && slot.season === this.season,
                ),
            ),
          )
          .map((swap) => {
            const first = s.bookings.find((b) => b.id === swap.first);
            const second = s.bookings.find((b) => b.id === swap.second);
            const receiving =
              second &&
              s.teams.find((t) => t.id === second.team)?.primary ===
                this.session?.user_id;
            return html`<article class="card">
              <h3>Booking exchange</h3>
              <p>${first ? this.describeBooking(first) : "Unknown booking"}</p>
              <p>
                ↔ ${second ? this.describeBooking(second) : "Unknown booking"}
              </p>
              <span class="badge">${swap.status}</span>
              <p class="muted">
                Accept before ${instantLabel(swap.deadline, s.gym.timezone)}
              </p>
              ${swap.status === "pending" && swap.deadline > s.now
                ? html`<div class="actions">
                    ${receiving
                      ? html`<button
                            ?disabled=${this.busy}
                            @click=${() =>
                              this.start(
                                {
                                  operation: "respond_swap",
                                  id: swap.id,
                                  accept: true,
                                  version: swap.version,
                                },
                                "Accept this swap? Both teams' times and gym spaces change together. No organizer approval is needed.",
                              )}
                          >
                            Accept swap</button
                          ><button
                            ?disabled=${this.busy}
                            @click=${() =>
                              this.start({
                                operation: "respond_swap",
                                id: swap.id,
                                accept: false,
                                version: swap.version,
                              })}
                          >
                            Decline swap
                          </button>`
                      : nothing}${swap.proposer === this.session?.user_id
                      ? html`<button
                          ?disabled=${this.busy}
                          @click=${() =>
                            this.start({
                              operation: "withdraw_swap",
                              id: swap.id,
                              version: swap.version,
                            })}
                        >
                          Withdraw swap
                        </button>`
                      : nothing}
                  </div>`
                : nothing}
            </article>`;
          })}
      </div>
      ${!s.swaps.length ? html`<p>No swap proposals yet.</p>` : nothing}
    </section>`;
  }
  private sharing(s: Schedule) {
    return html`<section aria-labelledby="sharing-title">
      <div class="section-heading">
        <h2 id="sharing-title">Team calendars for parents</h2>
        <gymtime-help-tip topic="sharing"></gymtime-help-tip>
      </div>
      <details>
        <summary>Message to share with parents</summary>
        <p>
          Here is our team calendar. No account is needed. Open the team webpage
          to see confirmed games and practices. Subscribe to the calendar to
          follow future changes; downloading the file gives you a snapshot. The
          team page has instructions for Apple, Google, and other calendar apps.
        </p>
      </details>
      <p class="muted">
        Anyone with a team link can view its confirmed schedule. Links are
        excluded from search. Internal notes and pending requests stay in the
        coach workspace. Calendar subscriptions refresh on the calendar app's
        schedule.
      </p>
      <div class="cards">
        ${s.teams
          .filter((t) => Boolean(t.share_token))
          .map(
            (t) =>
              html`<article class="card">
                <h3>${t.name}</h3>
                <a
                  href=${`/teams/${t.share_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  >Open ${t.name} parent calendar</a
                ><label
                  >Shareable webpage link<input
                    readonly
                    .value=${`${location.origin}/teams/${t.share_token}`} /></label
                ><label
                  >Subscription URL<input
                    readonly
                    .value=${`webcal://${location.host}/calendars/${t.share_token}.ics`} /></label
                ><a href=${`/calendars/${t.share_token}.ics`} download
                  >Download calendar file</a
                >${this.manageable(t.id)
                  ? html`<button
                      ?disabled=${this.busy}
                      @click=${() =>
                        this.start(
                          {
                            operation: "rotate_team_link",
                            team: t.id,
                            version: t.version,
                          },
                          `Replace ${t.name}'s public link? Its old webpage and calendar subscription stop working. Give parents the new link.`,
                        )}
                    >
                      Replace sharing link
                    </button>`
                  : nothing}
              </article>`,
          )}
      </div>
    </section>`;
  }
  private review(action: ScheduleAction | undefined, s: Schedule | undefined) {
    if (!action || !s) return nothing;
    if (
      action.operation === "cancel_booking" ||
      action.operation === "change_booking"
    ) {
      const source = s.bookings.find((b) => b.id === action.id);
      const sourceSlot = s.slots.find((slot) => slot.id === source?.slot);
      const affected = s.bookings.filter((b) => {
        const slot = s.slots.find((slot) => slot.id === b.slot);
        return Boolean(
          source &&
            slot &&
            slot.ends_at > s.now &&
            b.status === "confirmed" &&
            b.team === source.team &&
            (b.id === source.id ||
              (source.series &&
                b.series === source.series &&
                action.scope !== "one" &&
                (action.scope === "remaining" ||
                  slot.starts_at >= (sourceSlot?.starts_at ?? 0)))),
        );
      });
      return html`<h3>Original dates affected</h3>
        <ul>
          ${affected.map((b) => html`<li>${this.describeBooking(b)}</li>`)}
        </ul>
        ${action.operation === "change_booking"
          ? html`<h3>Requested replacement dates</h3>
              <ul>
                ${action.slots.map((id) => {
                  const slot = s.slots.find((slot) => slot.id === id);
                  return html`<li>
                    ${slot ? slotLabel(slot) : "Unknown slot"}
                  </li>`;
                })}
              </ul>`
          : nothing}`;
    }
    if (
      action.operation === "submit_requests" ||
      action.operation === "book_directly"
    )
      return html`<p>Team: ${this.teamName(action.team)}</p>
        <ul>
          ${action.slots.map((id) => {
            const slot = s.slots.find((slot) => slot.id === id);
            return html`<li>${slot ? slotLabel(slot) : "Unknown slot"}</li>`;
          })}
        </ul>
        ${action.operation === "book_directly"
          ? s.requests
              .filter(
                (request) =>
                  request.status === "pending" &&
                  s.slots.some(
                    (other) =>
                      other.id === request.slot &&
                      s.slots.some(
                        (slot) =>
                          action.slots.includes(slot.id) &&
                          slotsConflict(slot, other),
                      ),
                  ),
              )
              .map((request) => {
                const slot = s.slots.find((slot) => slot.id === request.slot);
                return html`<p class="status small">
                  Will cancel competing request: ${this.teamName(request.team)}
                  · ${slot ? slotLabel(slot) : "Unknown date"}
                </p>`;
              })
          : nothing}`;
    if (action.operation === "withdraw_requests")
      return html`<ul>
        ${action.ids.map((id) => {
          const r = s.requests.find((r) => r.id === id);
          const slot = s.slots.find((slot) => slot.id === r?.slot);
          return html`<li>
            ${r ? this.teamName(r.team) : "Team"} ·
            ${slot ? slotLabel(slot) : "Unknown date"}
          </li>`;
        })}
      </ul>`;
    if (action.operation === "decide_requests")
      return html`<h3>Decision preview</h3>
        <ul>
          ${action.decisions.map((d) => {
            const r = s.requests.find((r) => r.id === d.id);
            const slot = s.slots.find((slot) => slot.id === r?.slot);
            return html`<li>
              ${r ? this.teamName(r.team) : "Team"}:
              ${slot ? slotLabel(slot) : "Unknown date"} ·
              ${d.approve ? "Approve" : "Decline"}
            </li>`;
          })}
        </ul>
        ${s.requests
          .filter(
            (request) =>
              request.status === "pending" &&
              !action.decisions.some(
                (decision) => decision.id === request.id,
              ) &&
              action.decisions.some(
                (decision) =>
                  decision.approve &&
                  s.slots.some(
                    (a) =>
                      a.id === request.slot &&
                      s.requests.some(
                        (approved) =>
                          approved.id === decision.id &&
                          s.slots.some(
                            (b) =>
                              b.id === approved.slot && slotsConflict(a, b),
                          ),
                      ),
                  ),
              ),
          )
          .map((request) => {
            const slot = s.slots.find((slot) => slot.id === request.slot);
            return html`<p class="status small">
              Will cancel competing request: ${this.teamName(request.team)} ·
              ${slot ? slotLabel(slot) : "Unknown date"}
            </p>`;
          })}`;
    if (
      action.operation === "propose_swap" ||
      action.operation === "respond_swap"
    ) {
      const swap =
        action.operation === "respond_swap"
          ? s.swaps.find((swap) => swap.id === action.id)
          : undefined;
      const first = s.bookings.find(
        (b) =>
          b.id ===
          (action.operation === "propose_swap" ? action.first : swap?.first),
      );
      const second = s.bookings.find(
        (b) =>
          b.id ===
          (action.operation === "propose_swap" ? action.second : swap?.second),
      );
      return html`<p>
          ${first ? this.describeBooking(first) : "Unknown booking"}
        </p>
        <p>↔ ${second ? this.describeBooking(second) : "Unknown booking"}</p>`;
    }
    if (action.operation === "close_gym" && this.previewValue)
      return html`<ul>
        ${this.previewValue.affected_bookings.map((id) => {
          const b = s.bookings.find((b) => b.id === id);
          return html`<li>
            ${b ? this.describeBooking(b) : "Booking"} · will be cancelled
          </li>`;
        })}${this.previewValue.affected_requests.map((id) => {
          const r = s.requests.find((r) => r.id === id);
          const slot = s.slots.find((slot) => slot.id === r?.slot);
          return html`<li>
            Pending ${r ? this.teamName(r.team) : "request"} ·
            ${slot ? slotLabel(slot) : ""} · will be cancelled
          </li>`;
        })}
      </ul>`;
    return nothing;
  }
  override render() {
    const s = this.current;
    return html`<div @schedule-action=${this.handleAction}>
      ${this.failure
        ? html`<div role="alert" class="status error">
            <p>${this.failure.message}</p>
            ${this.failure.issues.map(
              (i) => html`<p>${i.field}: ${i.message}</p>`,
            )}${this.pending
              ? html`<button
                  ?disabled=${this.busy}
                  @click=${() => this.save.run()}
                >
                  Retry this action
                </button>`
              : nothing}
          </div>`
        : nothing}${this.message
        ? html`<p class="status" role="status">
            ${this.message}${this.message.startsWith("Request sent")
              ? html` <button
                  @click=${() => {
                    this.requestTeam = this.selectedTeam;
                    this.tab = "requests";
                  }}
                >
                  View requests
                </button>`
              : nothing}
          </p>`
        : nothing}${this.busy
        ? html`<p role="status">
            ${this.preview.status === TaskStatus.PENDING
              ? "Checking affected dates…"
              : "Saving schedule…"}
          </p>`
        : nothing}${!s
        ? this.load.render({
            pending: () => html`<p role="status">Loading gym schedule…</p>`,
            complete: (r) =>
              Either.isLeft(r)
                ? html`<p role="alert">${r.left.message}</p>
                    <button @click=${() => this.load.run()}>Try again</button>`
                : nothing,
            error: () =>
              html`<p role="alert">The service could not be reached.</p>
                <button @click=${() => this.load.run()}>Try again</button>`,
          })
        : html`
            <div class="workspace-heading">
              <div>
                <p class="eyebrow">
                  ${this.session?.organizer
                    ? "Organizer workspace"
                    : "Coach workspace"}
                </p>
                <h1>${s.gym.name}</h1>
              </div>
              <label
                >Season<select
                  aria-label="Season"
                  .value=${String(this.season)}
                  @change=${(event: Event) => {
                    if (event.currentTarget instanceof HTMLSelectElement) {
                      this.season = Number(event.currentTarget.value);
                      this.selectedTeam =
                        s.teams.find(
                          (team) =>
                            this.manageable(team.id) &&
                            team.seasons.includes(this.season),
                        )?.id ?? 0;
                      this.teamFilter = this.session?.organizer ? 0 : -1;
                      const first = s.slots.find(
                        (slot) => slot.season === this.season,
                      );
                      if (first) {
                        this.day = first.date;
                        this.week = monday(first.date);
                        this.finderEnd = shiftDate(first.date, 6);
                      }
                      this.selected = [];
                      this.excluded = [];
                      this.edit = undefined;
                      this.historyPage = 0;
                    }
                  }}
                >
                  ${!s.seasons.length
                    ? html`<option value="0">No season yet</option>`
                    : nothing}
                  ${s.seasons.map(
                    (season) =>
                      html`<option value=${season.id}>
                        ${season.name} · ${season.status}
                      </option>`,
                  )}
                </select></label
              >
            </div>
            <nav aria-label="Workspace">
              <button
                aria-current=${this.tab === "calendar" ? "page" : "false"}
                @click=${() => {
                  this.tab = "calendar";
                }}
              >
                Calendar</button
              ><button
                aria-current=${this.tab === "requests" ? "page" : "false"}
                @click=${() => {
                  this.tab = "requests";
                }}
              >
                Requests
                (${s.requests.filter(
                  (request) =>
                    request.status === "pending" &&
                    s.slots.some(
                      (slot) =>
                        slot.id === request.slot && slot.season === this.season,
                    ),
                ).length})</button
              ><button
                aria-current=${this.tab === "swaps" ? "page" : "false"}
                @click=${() => {
                  this.tab = "swaps";
                }}
              >
                Swaps</button
              ><button
                aria-current=${this.tab === "history" ? "page" : "false"}
                @click=${() => {
                  this.tab = "history";
                }}
              >
                History</button
              ><button
                aria-current=${this.tab === "sharing" ? "page" : "false"}
                @click=${() => {
                  this.tab = "sharing";
                }}
              >
                Parent links</button
              ><button
                aria-current=${this.tab === "inbox" ? "page" : "false"}
                @click=${() => {
                  this.tab = "inbox";
                }}
              >
                Notifications</button
              >${this.session?.organizer
                ? html`<details class="admin-menu">
                    <summary>Administration</summary>
                    <div class="actions">
                      <button
                        @click=${() => {
                          this.tab = "setup";
                        }}
                      >
                        Gym setup</button
                      ><button
                        @click=${() => {
                          this.tab = "people";
                        }}
                      >
                        People
                      </button>
                    </div>
                  </details>`
                : nothing}
              <button
                aria-current=${this.tab === "help" ? "page" : "false"}
                @click=${() => {
                  this.tab = "help";
                }}
              >
                Help
              </button>
            </nav>
            ${this.helpWarning
              ? html`<p class="info-box" role="status">${this.helpWarning}</p>`
              : nothing}
            ${this.tab !== "help" &&
            this.guidanceLoad.status === TaskStatus.COMPLETE &&
            !this.helpPreferences.intro_hidden
              ? this.guide(s, true)
              : nothing}
            ${!s.seasons.length && this.tab !== "help"
              ? html`<p class="status">
                  ${this.session?.organizer
                    ? "Start in Gym setup: define opening hours, create a season, add teams, and preview slots."
                    : "Your organizer is preparing the season. Your team's slots will appear here."}
                </p>`
              : nothing}
            ${this.tab === "help"
              ? this.guide(s)
              : this.tab === "calendar"
                ? this.calendar(s)
                : this.tab === "finder"
                  ? this.finder(s)
                  : this.tab === "history"
                    ? this.history(s)
                    : this.tab === "swaps"
                      ? this.swaps(s)
                      : this.tab === "requests"
                        ? this.requests(s)
                        : this.tab === "setup"
                          ? html`<gymtime-setup
                              .schedule=${s}
                              .focusSection=${this.setupSection}
                              .season=${this.season}
                              .busy=${this.busy}
                              .issues=${this.failure?.issues ?? []}
                            ></gymtime-setup>`
                          : this.tab === "people"
                            ? html`<gymtime-accounts
                                .session=${this.session}
                              ></gymtime-accounts>`
                            : this.tab === "sharing"
                              ? this.sharing(s)
                              : html`<gymtime-inbox
                                  .session=${this.session}
                                  .busy=${this.busy}
                                ></gymtime-inbox>`}
            ${this.selected.length
              ? html`<div class="selection-bar">
                  <strong>${this.selected.length} times selected</strong
                  ><button class="primary" @click=${() => this.openSelection()}>
                    Review selection</button
                  ><button
                    @click=${() => {
                      this.tab = "finder";
                    }}
                  >
                    Find more time
                  </button>
                </div>`
              : nothing}
          `}
      <dialog id="booking-dialog" aria-labelledby="booking-dialog-title">
        <div class="section-heading">
          <div class="section-heading">
            <h2 id="booking-dialog-title">Booking details</h2>
            <gymtime-help-tip topic="changes"></gymtime-help-tip>
          </div>
          <button
            @click=${() =>
              this.renderRoot
                .querySelector<HTMLDialogElement>("#booking-dialog")
                ?.close()}
          >
            Close
          </button>
        </div>
        ${s
          ? s.bookings
              .filter((booking) => booking.id === this.activeBooking)
              .map((booking) => this.bookingCard(booking, s))
          : nothing}
      </dialog>
      <dialog id="slot-dialog" aria-labelledby="slot-dialog-title">
        <div class="section-heading">
          <h2 id="slot-dialog-title">Gym time unavailable</h2>
          <button
            @click=${() =>
              this.renderRoot
                .querySelector<HTMLDialogElement>("#slot-dialog")
                ?.close()}
          >
            Close availability
          </button>
        </div>
        ${s
          ? s.slots
              .filter((slot) => slot.id === this.activeSlot)
              .map(
                (slot) =>
                  html`<p>${slotLabel(slot)}</p>
                    ${s.closures
                      .filter(
                        (closure) =>
                          closure.active &&
                          closure.starts_at < slot.ends_at &&
                          slot.starts_at < closure.ends_at &&
                          (closure.space === "full" ||
                            slot.space === "full" ||
                            closure.space === slot.space),
                      )
                      .map(
                        (closure) =>
                          html`<p class="status">
                            ${closure.reason} · ${spaceLabel(closure.space)}<br />${instantLabel(
                              closure.starts_at,
                              s.gym.timezone,
                            )}
                            – ${instantLabel(closure.ends_at, s.gym.timezone)}
                          </p>`,
                      )}${!slot.enabled
                      ? html`<p>This slot is unpublished.</p>`
                      : nothing}`,
              )
          : nothing}
      </dialog>
      <dialog id="selection-dialog" aria-label="Review selected times">
        <button
          @click=${() =>
            this.renderRoot
              .querySelector<HTMLDialogElement>("#selection-dialog")
              ?.close()}
        >
          Close review</button
        >${s && this.selectionOpen ? this.requestForm(s, "dialog") : nothing}
      </dialog>
      <dialog
        id="confirm-dialog"
        aria-labelledby="confirm-title"
        @cancel=${() => this.dismiss()}
      >
        <h2 id="confirm-title">
          ${this.previewValue
            ? "Review affected dates"
            : "Confirm schedule change"}
        </h2>
        <p>${this.confirmation}</p>
        ${this.pending?.operation === "close_gym"
          ? html`<p>
                ${this.pending.start_date} ${this.pending.start} –
                ${this.pending.end_date} ${this.pending.end} ·
                ${spaceLabel(this.pending.space)}
              </p>
              <p>Reason: ${this.pending.reason}</p>`
          : nothing}${this.previewValue
          ? html`${this.previewValue.occurrences.length
              ? html`<ul>
                  ${this.previewValue.occurrences.map(
                    (o) =>
                      html`<li>
                        ${o.date}:
                        ${o.error
                          ? `${o.error.message} ${o.error.issues.map((i) => i.message).join(" ")}`
                          : `${o.start}–${o.end} · ${o.space ? spaceLabel(o.space) : ""}`}
                      </li>`,
                  )}
                </ul>`
              : html`<p>
                  This closure will cancel
                  ${this.previewValue.affected_bookings.length} confirmed
                  booking(s) and ${this.previewValue.affected_requests.length}
                  pending request(s).
                </p>`}`
          : nothing}${this.review(this.pending, s)}${this.excluded.length
          ? html`<h3>Excluded recurring dates</h3>
              <ul>
                ${this.excluded.map(
                  (d) => html`<li>${d.date}: ${d.reason}</li>`,
                )}
              </ul>`
          : nothing}
        <div class="actions">
          <button @click=${this.dismiss}>Go back</button
          ><button
            class="primary"
            ?disabled=${this.previewValue?.occurrences.some((o) =>
              Boolean(o.error),
            ) ||
            this.busy ||
            (this.pending?.operation === "create_slots" &&
              this.previewValue?.occurrences.length === 0)}
            @click=${this.confirm}
          >
            Confirm and save
          </button>
        </div>
      </dialog>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-planner": GymtimePlanner;
  }
}
