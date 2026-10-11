import { each, type ChildValue, html, nothing } from "@gyral/core";
import { slotLabel } from "../../components/planner-forms.js";
import { reviewGroups, shortTeam } from "../../domain/schedule-views.js";
import {
  dateLabel,
  Request,
  type Booking,
  type Schedule,
} from "../../domain/schedule.js";
import { teamName } from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
import { requestDetail } from "./requests.js";
export const history = (v: WorkspaceView, s: Schedule): ChildValue => {
  const requests = v.historyKind === "requests";
  const matches = (record: Booking | typeof Request.Type) => {
    const slot = s.slots.find((slot) => slot.id === record.slot);
    return (
      slot?.season === v.season &&
      `${teamName(v, record.team)} ${slot.date} ${record.status} ${record.activity}`
        .toLowerCase()
        .includes(v.historySearch.toLowerCase())
    );
  };
  const completed = s.requests.filter(
    (request) =>
      request.status !== "pending" &&
      s.slots.some(
        (slot) => slot.id === request.slot && slot.season === v.season,
      ),
  );
  const groups = reviewGroups(s, completed)
    .filter((group) =>
      group.requests.some(
        (record) =>
          matches(record) &&
          (v.historyStatus === "all" || record.status === v.historyStatus),
      ),
    )
    .reverse();
  const bookings = s.bookings
    .filter(
      (record) =>
        matches(record) &&
        (v.historyStatus === "all" || record.status === v.historyStatus),
    )
    .sort(
      (a, b) =>
        (s.slots.find((slot) => slot.id === b.slot)?.starts_at ?? 0) -
        (s.slots.find((slot) => slot.id === a.slot)?.starts_at ?? 0),
    );
  const total = requests ? groups.length : bookings.length;
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(v.historyPage, pages - 1);
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
          value=${v.historyKind}
          data-intent=${i.TextFilter}
          data-field="historyKind"
        >
          <option value="bookings">Bookings</option>
          <option value="requests">Completed requests</option>
        </select></label
      ><label
        >Search team, date or activity<input
          type="search"
          value=${v.historySearch}
          data-intent=${i.TextFilter}
          data-field="historySearch" /></label
      ><label
        >Status filter<select
          value=${v.historyStatus}
          data-intent=${i.TextFilter}
          data-field="historyStatus"
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
        ? each(
            groups.slice(page * 20, page * 20 + 20),
            (group) => group.key,
            completedGroup,
            () => ({ v, s }),
          )
        : each(
            bookings.slice(page * 20, page * 20 + 20),
            (booking) => booking.id,
            historyBooking,
            () => ({ v, s }),
          )}
    </div>
    <div class="actions">
      <button
        ?disabled=${page === 0}
        data-intent=${i.HistoryPage}
        value=${page - 1}
      >
        Previous page</button
      ><span>Page ${page + 1} of ${pages}</span
      ><button
        ?disabled=${page + 1 >= pages}
        data-intent=${i.HistoryPage}
        value=${page + 1}
      >
        Next page
      </button>
    </div>
    ${!total ? html`<p>No records match these filters.</p>` : nothing}
  </section>`;
};

const completedGroup = (
  group: ReturnType<typeof reviewGroups>[number],
  { v, s }: { readonly v: WorkspaceView; readonly s: Schedule },
): ChildValue =>
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
          >${dateLabel(group.firstDate)} · ${group.requests.length} dates</small
        ></span
      ><span class="badge"
        >${[...new Set(group.requests.map((request) => request.status))]
          .length > 1
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
      ${group.requests.map((request) => requestDetail(v, request, s))}
    </div>
  </details>`;
const historyBooking = (
  booking: Booking,
  { v, s }: { readonly v: WorkspaceView; readonly s: Schedule },
): ChildValue => {
  const slot = s.slots.find((slot) => slot.id === booking.slot);
  return html`<div class="history-row">
    <span
      ><strong>${shortTeam(teamName(v, booking.team))}</strong
      ><small
        >${slot ? slotLabel(slot) : "Unknown time"} · ${booking.activity}</small
      ></span
    ><span class="badge">${booking.status.replaceAll("_", " ")}</span
    ><button data-intent=${i.Booking} value=${booking.id}>
      Booking details
    </button>
  </div>`;
};
