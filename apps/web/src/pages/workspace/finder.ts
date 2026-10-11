import { html, nothing, type ChildValue } from "@gyral/core";
import { formErrors } from "../../components/form-errors.js";
import {
  activityField,
  noteField,
  scopeField,
  slotLabel,
} from "../../components/planner-forms.js";
import { noIssues } from "../../components/props.js";
import {
  pendingAt,
  shortTeam,
  timeRange,
} from "../../domain/schedule-views.js";
import {
  dateLabel,
  slotsConflict,
  spaceLabel,
  type Schedule,
} from "../../domain/schedule.js";
import { describeBooking, manageable, teamName } from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
const formIssues = (v: WorkspaceView, key: string) =>
  v.errorForm === key ? (v.failure?.issues ?? noIssues) : noIssues;
export const finder = (v: WorkspaceView, s: Schedule): ChildValue => {
  const end = v.finderEnd >= v.day ? v.finderEnd : v.day;
  const choices = s.slots
    .filter(
      (slot) =>
        slot.season === v.season &&
        (slot.available || slot.id === v.edit?.slot) &&
        slot.ends_at > s.now &&
        slot.date >= v.day &&
        slot.date <= end &&
        (v.spaceFilter === "all" || slot.space === v.spaceFilter),
    )
    .sort(
      (a, b) => a.starts_at - b.starts_at || a.space.localeCompare(b.space),
    );
  const dates = [...new Set(choices.map((slot) => slot.date))];
  return html`<section aria-labelledby="finder-title">
    <div class="section-heading">
      <div>
        <h2 id="finder-title">
          ${v.edit
            ? "Choose replacement time"
            : v.session?.organizer
              ? "Assign gym time"
              : "Find gym time"}
        </h2>
        <p class="muted">
          Choose published times. Selections stay while you browse other dates.
        </p>
      </div>
      <button data-intent=${i.Tab} value="calendar">Back to calendar</button>
    </div>
    <gymtime-help-tip topic="finder"></gymtime-help-tip>
    ${v.walkthrough >= 0
      ? html`<aside class="info-box" aria-labelledby="walkthrough-title">
          <div class="section-heading">
            <h3 id="walkthrough-title">
              Request time · Step ${v.walkthrough + 1} of 3
            </h3>
            <button data-intent=${i.Walkthrough} value=${-1}>
              Close walkthrough
            </button>
          </div>
          <p>
            ${[
              "Choose your team and date range below. Select the published times you want. Pending requests do not reserve a slot; a competing request needs your reason.",
              "Review your selected times in the side panel or use Review selection on mobile. For a weekly pattern, open Repeat weekly and review all excluded dates. Notes stay internal.",
              "Check the team, dates, space, and activity, then send your request when ready. The organizer must approve it. This walkthrough does not send anything for you.",
            ][v.walkthrough]}
          </p>
          <div class="actions">
            ${v.walkthrough > 0
              ? html`<button
                  data-intent=${i.Walkthrough}
                  value=${v.walkthrough - 1}
                >
                  Previous tip
                </button>`
              : nothing}<button
              data-intent=${i.Walkthrough}
              value=${v.walkthrough === 2 ? -1 : v.walkthrough + 1}
            >
              ${v.walkthrough === 2 ? "Finish walkthrough" : "Next tip"}
            </button>
          </div>
        </aside>`
      : nothing}
    <div class="finder-layout">
      <div>
        <div class="fields finder-filters">
          <label
            >Team<select
              value=${String(v.selectedTeam)}
              data-intent=${i.NumberFilter}
              data-field="selectedTeam"
              ?disabled=${Boolean(v.edit)}
            >
              ${s.teams
                .filter(
                  (team) =>
                    manageable(v, team.id) && team.seasons.includes(v.season),
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
              value=${v.day}
              data-intent=${i.FinderDate} /></label
          ><label
            >Through date<input
              type="date"
              min=${v.day}
              value=${end}
              data-intent=${i.TextFilter}
              data-field="finderEnd" /></label
          ><label
            >Space filter<select
              value=${v.spaceFilter}
              data-intent=${i.TextFilter}
              data-field="spaceFilter"
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
                          aria-pressed=${v.selected.includes(slot.id)}
                          aria-label=${`Select ${slotLabel(slot)}`}
                          ?disabled=${v.busy}
                          data-intent=${i.ToggleSlot}
                          value=${slot.id}
                        >
                          <strong>${timeRange(slot)}</strong
                          ><span>${spaceLabel(slot.space)}</span
                          ><small
                            >${v.selected.includes(slot.id)
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
              No published available times match these filters. Try another date
              or space.
            </p>`
          : nothing}
      </div>
      <div class="desktop-selection">${requestForm(v, s)}</div>
    </div>
  </section>`;
};
export const requestForm = (
  v: WorkspaceView,
  s: Schedule,
  context: "desktop" | "dialog" = "desktop",
): ChildValue => {
  const edit = v.edit;
  const anchors = s.slots.filter((slot) => v.selected.includes(slot.id));
  const season = s.seasons.find((season) => season.id === v.season);
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
      <strong>${v.selected.length} times selected</strong> ·
      ${shortTeam(teamName(v, edit?.team ?? v.selectedTeam))}
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
          Current: ${describeBooking(v, edit)}. Original stays confirmed until
          approval.
        </p>`
      : nothing}${v.selected.length
      ? html`<details class="selected-dates">
          <summary>Selected dates · ${v.selected.length}</summary>
          <ul>
            ${anchors.map(
              (slot) =>
                html`<li>
                  ${slotLabel(slot)}
                  <button
                    type="button"
                    aria-label=${`Remove ${slotLabel(slot)}`}
                    data-intent=${i.ToggleSlot}
                    value=${slot.id}
                  >
                    Remove
                  </button>
                </li>`,
            )}
          </ul>
        </details>`
      : html`<p class="muted">Select a time to get started.</p>`}
    ${v.selected.length && season
      ? html`<details class="repeat-weekly">
          <summary>Repeat weekly</summary>
          <gymtime-help-tip topic="recurring"></gymtime-help-tip>
          <p class="small">
            Repeat every selected weekday, time, and space. Missing or
            unavailable dates are excluded.
          </p>
          <form data-intent=${i.Weekly}>
            <label
              >Repeat through<input
                name="until"
                type="date"
                required
                min=${anchors[0]?.date ?? season.start_date}
                max=${season.end_date}
                value=${season.end_date} /></label
            ><button>Select matching weekly slots</button>
          </form>
        </details>`
      : nothing}
    ${v.excluded.length
      ? html`<details>
          <summary>
            ${v.excluded.length} excluded
            ${v.excluded.length === 1 ? "date" : "dates"} · Review exceptions
          </summary>
          <ul>
            ${v.excluded.map(
              (excluded) =>
                html`<li>${dateLabel(excluded.date)}: ${excluded.reason}</li>`,
            )}
          </ul>
        </details>`
      : nothing}
    <form
      data-intent-input=${i.Draft}
      data-intent-change=${i.Draft}
      data-intent=${i.RequestTime}
      data-form-key=${`selection-${context}`}
      ${formErrors(formIssues(v, `selection-${context}`))}
    >
      <fieldset ?disabled=${v.busy || !v.selected.length}>
        <div class="fields">
          ${edit
            ? scopeField(edit.series, v.selectionDraft.scope)
            : nothing}${activityField(v.selectionDraft.activity)}${v.session
            ?.organizer && !edit
            ? html`<label
                >Booking method<select
                  name="mode"
                  value=${v.bookingMode}
                  data-intent=${i.TextFilter}
                  data-field="bookingMode"
                >
                  <option value="direct">Confirm directly</option>
                  <option value="request">Submit for approval</option>
                </select></label
              >`
            : nothing}
        </div>
        <details>
          <summary>Add a note</summary>
          ${noteField(v.selectionDraft.note)}
        </details>
        ${competitors.length
          ? html`<div class="status small">
              <p>
                Another request is pending:
                ${[
                  ...new Set(
                    competitors.map((request) =>
                      shortTeam(teamName(v, request.team)),
                    ),
                  ),
                ].join(", ")}.
                These times remain available.
              </p>
              ${v.session?.organizer && !edit && v.bookingMode === "direct"
                ? html`<p>
                    Assigning these times cancels competing pending requests.
                  </p>`
                : html`<label
                    >Competing request reason<textarea
                      name="reason"
                      required
                      maxlength="2000"
                    >
${v.selectionDraft.reason}</textarea
                    >
                  </label>`}
            </div>`
          : nothing}
        <div class="actions">
          <button class="primary">
            ${edit
              ? "Submit change request"
              : v.session?.organizer
                ? "Assign selected times"
                : "Submit selected dates"}
          </button>
        </div>
      </fieldset>
    </form>
    ${v.selected.length || edit
      ? html`<button type="button" data-intent=${i.ClearSelection}>
          Clear selection
        </button>`
      : nothing}
  </aside>`;
};
