import {
  each,
  html,
  nothing,
  type ChildValue,
  type TemplateResult,
} from "@gyral/core";
import { formErrors } from "../../components/form-errors.js";
import {
  activityField,
  noteField,
  scopeField,
  slotLabel,
} from "../../components/planner-forms.js";
import { noIssues } from "../../components/props.js";
import {
  reviewGroups,
  shortTeam,
  timeRange,
} from "../../domain/schedule-views.js";
import {
  dateLabel,
  Request,
  spaceLabel,
  type Schedule,
} from "../../domain/schedule.js";
import {
  decisionConflict,
  manageable,
  sameRowContext,
  teamName,
} from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
const formIssues = (v: WorkspaceView, key: string) =>
  v.errorForm === key ? (v.failure?.issues ?? noIssues) : noIssues;
export const requests = (v: WorkspaceView, s: Schedule): ChildValue => {
  const pending = s.requests.filter(
    (request) =>
      request.status === "pending" &&
      s.slots.some(
        (slot) => slot.id === request.slot && slot.season === v.season,
      ),
  );
  const allGroups = reviewGroups(s, pending);
  const groups = allGroups.filter(
    (group) =>
      (!v.competingOnly || group.competing) &&
      group.requests.some(
        (request) =>
          (!v.requestTeam || request.team === v.requestTeam) &&
          (v.requestType === "all" ||
            (v.requestType === "change"
              ? Boolean(request.replacement)
              : !request.replacement)) &&
          (!v.requestDate ||
            s.slots.some(
              (slot) => slot.id === request.slot && slot.date === v.requestDate,
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
          ${allGroups.length} review items · ${pending.length} pending requests
        </p>
      </div>
      <button data-intent=${i.RequestHistory}>Request history</button>
    </div>
    <details class="request-filters">
      <summary>
        Filter
        requests${v.requestTeam ||
        v.requestType !== "all" ||
        v.requestDate ||
        v.competingOnly
          ? " · Filters applied"
          : ""}
      </summary>
      <div class="fields">
        <label
          >Team filter<select
            value=${String(v.requestTeam)}
            data-intent=${i.NumberFilter}
            data-field="requestTeam"
          >
            <option value="0">All teams</option>
            ${s.teams.map(
              (team) =>
                html`<option value=${team.id}>${shortTeam(team.name)}</option>`,
            )}
          </select></label
        ><label
          >Request type<select
            value=${v.requestType}
            data-intent=${i.TextFilter}
            data-field="requestType"
          >
            <option value="all">All types</option>
            <option value="new">New time</option>
            <option value="change">Time change</option>
          </select></label
        ><label
          >Affected date<input
            type="date"
            value=${v.requestDate}
            data-intent=${i.TextFilter}
            data-field="requestDate" /></label
        ><label class="check"
          ><input
            type="checkbox"
            ?checked=${v.competingOnly}
            data-intent=${i.Competing}
          />Competing only</label
        >
      </div>
      <button data-intent=${i.ClearRequestFilters}>Clear filters</button>
    </details>
    ${v.decisions.length
      ? html`<div class="decision-bar actions">
          <strong>${v.decisions.length} dates selected</strong
          ><button
            class="primary"
            ?disabled=${v.busy || decisionConflict(v, s)}
            data-intent=${i.Decide}
            data-approve="true"
          >
            Approve selected dates</button
          ><button
            ?disabled=${v.busy}
            data-intent=${i.Decide}
            data-approve="false"
          >
            Decline selected dates</button
          >${decisionConflict(v, s)
            ? html`<p>
                Selected requests compete. Choose compatible dates before
                approval.
              </p>`
            : nothing}
        </div>`
      : nothing}
    <div class="review-list">
      ${each(groups, (group) => group.key, reviewRow, {
        pick: () => ({ v, s }),
        equals: sameRowContext,
      })}
    </div>
    ${!groups.length
      ? html`<p class="status">
          ${pending.length
            ? "No requests match these filters."
            : "All caught up · no requests need review."}
        </p>`
      : nothing}
  </section>`;
};
export const requestDetail = (
  v: WorkspaceView,
  r: typeof Request.Type,
  s: Schedule,
): ChildValue => {
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
      <h3>${shortTeam(teamName(v, r.team))}</h3>
      <p>${slot ? slotLabel(slot) : "Unknown time"} · ${r.activity}</p>
      ${original
        ? html`<p class="change-comparison">
            <strong>Current · confirmed:</strong> ${s.slots
              .filter((slot) => slot.id === original.slot)
              .map((slot) => slotLabel(slot))}<br /><strong>Requested →</strong>
            ${slot ? slotLabel(slot) : "Unknown time"}
          </p>`
        : nothing}<span class="badge">${r.status.replaceAll("_", " ")}</span
      >${r.note || r.reason
        ? html`<details>
            <summary>${r.reason ? "Reason and note" : "Internal note"}</summary>
            ${r.reason ? html`<p>Reason: ${r.reason}</p>` : nothing}${r.note
              ? html`<p>${r.note}</p>`
              : nothing}
          </details>`
        : nothing}
    </div>
    ${pending && v.session?.organizer
      ? html`<div class="actions">
          <label class="check"
            ><input
              type="checkbox"
              ?checked=${v.decisions.includes(r.id)}
              data-intent=${i.ToggleDecision}
              value=${r.id}
              aria-label=${`Select request ${r.id} from ${teamName(v, r.team)}`}
            />Select date</label
          ><button
            class="primary"
            ?disabled=${v.busy}
            data-intent=${i.Decide}
            data-approve="true"
            value=${r.id}
          >
            Approve date</button
          ><button
            ?disabled=${v.busy}
            data-intent=${i.Decide}
            data-approve="false"
            value=${r.id}
          >
            Decline date
          </button>
        </div>`
      : nothing}${pending && manageable(v, r.team)
      ? html`<details>
          <summary>Manage request</summary>
          <details>
            <summary>Withdraw pending dates</summary>
            <form
              data-intent=${i.WithdrawRequests}
              data-form-key=${`withdraw-${r.id}`}
              data-request=${r.id}
              ${formErrors(formIssues(v, `withdraw-${r.id}`))}
            >
              <fieldset ?disabled=${v.busy}>
                ${scopeField(r.series)}<button>Withdraw request</button>
              </fieldset>
            </form>
          </details>
          <details>
            <summary>Edit pending request</summary>
            <form
              data-intent=${i.EditRequest}
              data-form-key=${`request-${r.id}`}
              data-request=${r.id}
              ${formErrors(formIssues(v, `request-${r.id}`))}
            >
              <fieldset ?disabled=${v.busy}>
                <label
                  >Requested date<input
                    type="date"
                    value=${v.editDates[`request-${r.id}`] ?? slot?.date ?? ""}
                    data-intent=${i.EditDate}
                    data-record=${`request-${r.id}`} /></label
                ><label
                  >Requested slot<select name="slot" required>
                    ${s.slots
                      .filter(
                        (candidate) =>
                          candidate.season === v.season &&
                          candidate.date ===
                            (v.editDates[`request-${r.id}`] ?? slot?.date) &&
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
                  >Competing reason<textarea name="reason" maxlength="2000">
${r.reason}</textarea
                  ></label
                ><button>Save pending request</button>
              </fieldset>
            </form>
          </details>
        </details>`
      : nothing}
  </article>`;
};

const reviewRow = (
  group: ReturnType<typeof reviewGroups>[number],
  { v, s }: { readonly v: WorkspaceView; readonly s: Schedule },
): TemplateResult =>
  html`<details class="review-item">
    <summary>
      <span
        ><strong
          >${[
            ...new Set(
              group.requests.map((request) =>
                shortTeam(teamName(v, request.team)),
              ),
            ),
          ].join(" / ")}</strong
        ><small
          >${[
            ...new Set(
              group.requests.map((request) => {
                const slot = s.slots.find((slot) => slot.id === request.slot);
                return slot
                  ? `${timeRange(slot)} · ${spaceLabel(slot.space)}`
                  : "";
              }),
            ),
          ].join(" / ")}</small
        ><small
          >${dateLabel(group.firstDate)}${group.requests.length > 1 &&
          s.slots.find((slot) => slot.id === group.requests.at(-1)?.slot)
            ?.date !== group.firstDate
            ? ` – ${dateLabel(s.slots.find((slot) => slot.id === group.requests.at(-1)?.slot)?.date ?? group.firstDate)}`
            : ""}
          · ${group.requests.length}
          ${group.requests.length === 1 ? "request" : "requests"}</small
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
      ${!group.competing && group.requests.length > 1 && v.session?.organizer
        ? html`<button
            ?disabled=${v.busy}
            data-intent=${i.SelectGroup}
            value=${group.key}
          >
            Select all dates in this group
          </button>`
        : nothing}
      ${group.competing
        ? html`<p class="status small">
            Compare these requests. Approving a date cancels physically
            competing requests; compatible halves remain available.
          </p>`
        : nothing}${group.requests.map((request) =>
        requestDetail(v, request, s),
      )}
    </div>
  </details>`;
