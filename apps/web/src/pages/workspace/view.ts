import { html, nothing, type ChildValue } from "@gyral/core";
import { slotLabel } from "../../components/planner-forms.js";
import { instantLabel, spaceLabel } from "../../domain/schedule.js";
import { bookingCard } from "./bookings.js";
import { finder, requestForm } from "./finder.js";
import { history } from "./history.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
import { calendar, guide } from "./navigation.js";
import { requests } from "./requests.js";
import { review } from "./review.js";
import { sharing } from "./sharing.js";
import { swaps } from "./swaps.js";
export const workspaceView = (v: WorkspaceView): ChildValue => {
  const s = v.current;
  return html`<div>
    ${v.failure
      ? html`<div role="alert" class="status error">
          <p>${v.failure.message}</p>
          ${v.failure.issues.map(
            (i) => html`<p>${i.field}: ${i.message}</p>`,
          )}${v.pending
            ? html`<button ?disabled=${v.busy} data-intent=${i.RetryAction}>
                Retry this action
              </button>`
            : nothing}
        </div>`
      : nothing}${v.message
      ? html`<p class="status" role="status">
          ${v.message}${v.message.startsWith("Request sent")
            ? html` <button data-intent=${i.ViewRequests}>
                View requests
              </button>`
            : nothing}
        </p>`
      : nothing}${v.busy
      ? html`<p role="status">
          ${v.operation === "Previewing"
            ? "Checking affected dates…"
            : "Saving schedule…"}
        </p>`
      : nothing}${!s
      ? html`<p role="status">
            ${v.loadStatus === "Loading"
              ? "Loading gym schedule…"
              : "The schedule could not be loaded."}
          </p>
          <button data-intent=${i.Refresh}>Try again</button>`
      : html`
          <div class="workspace-heading">
            <div>
              <p class="eyebrow">
                ${v.session?.organizer
                  ? "Organizer workspace"
                  : "Coach workspace"}
              </p>
              <h1>${s.gym.name}</h1>
            </div>
            <label
              >Season<select
                aria-label="Season"
                value=${String(v.season)}
                data-intent=${i.Season}
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
              aria-current=${v.tab === "calendar" ? "page" : "false"}
              data-intent=${i.Tab}
              value="calendar"
            >
              Calendar</button
            ><button
              aria-current=${v.tab === "requests" ? "page" : "false"}
              data-intent=${i.Tab}
              value="requests"
            >
              Requests
              (${s.requests.filter(
                (request) =>
                  request.status === "pending" &&
                  s.slots.some(
                    (slot) =>
                      slot.id === request.slot && slot.season === v.season,
                  ),
              ).length})</button
            ><button
              aria-current=${v.tab === "swaps" ? "page" : "false"}
              data-intent=${i.Tab}
              value="swaps"
            >
              Swaps</button
            ><button
              aria-current=${v.tab === "history" ? "page" : "false"}
              data-intent=${i.Tab}
              value="history"
            >
              History</button
            ><button
              aria-current=${v.tab === "sharing" ? "page" : "false"}
              data-intent=${i.Tab}
              value="sharing"
            >
              Parent links</button
            ><button
              aria-current=${v.tab === "inbox" ? "page" : "false"}
              data-intent=${i.Tab}
              value="inbox"
            >
              Notifications</button
            >${v.session?.organizer
              ? html`<details class="admin-menu">
                  <summary>Administration</summary>
                  <div class="actions">
                    <button data-intent=${i.Tab} value="setup">Gym setup</button
                    ><button data-intent=${i.Tab} value="people">People</button>
                  </div>
                </details>`
              : nothing}
            <button
              aria-current=${v.tab === "help" ? "page" : "false"}
              data-intent=${i.Tab}
              value="help"
            >
              Help
            </button>
          </nav>
          ${v.helpWarning
            ? html`<p class="info-box" role="status">${v.helpWarning}</p>`
            : nothing}
          ${v.tab !== "help" &&
          v.guidanceStatus === "Ready" &&
          !v.helpPreferences.intro_hidden
            ? guide(v, s, true)
            : nothing}
          ${!s.seasons.length && v.tab !== "help"
            ? html`<p class="status">
                ${v.session?.organizer
                  ? "Start in Gym setup: define opening hours, create a season, add teams, and preview slots."
                  : "Your organizer is preparing the season. Your team's slots will appear here."}
              </p>`
            : nothing}
          ${v.tab === "help"
            ? guide(v, s)
            : v.tab === "calendar"
              ? calendar(v, s)
              : v.tab === "finder"
                ? finder(v, s)
                : v.tab === "history"
                  ? history(v, s)
                  : v.tab === "swaps"
                    ? swaps(v, s)
                    : v.tab === "requests"
                      ? requests(v, s)
                      : v.tab === "setup"
                        ? html`<gymtime-setup
                            data-intent=${i.Action}
                            .errorForm=${v.errorForm}
                            .schedule=${s}
                            .focusSection=${v.setupSection}
                            .season=${v.season}
                            .busy=${v.busy}
                            .issues=${v.failure?.issues ?? []}
                          ></gymtime-setup>`
                        : v.tab === "people"
                          ? html`<gymtime-accounts
                              .session=${v.session}
                            ></gymtime-accounts>`
                          : v.tab === "sharing"
                            ? sharing(v, s)
                            : html`<gymtime-inbox
                                data-intent=${i.Action}
                                .session=${v.session}
                                .busy=${v.busy}
                              ></gymtime-inbox>`}
          ${v.selected.length
            ? html`<div class="selection-bar">
                <strong>${v.selected.length} times selected</strong
                ><button class="primary" data-intent=${i.Selection}>
                  Review selection</button
                ><button data-intent=${i.Tab} value="finder">
                  Find more time
                </button>
              </div>`
            : nothing}
        `}
    <dialog
      id="booking-dialog"
      ?modal=${v.dialog === "Booking"}
      data-intent-close=${i.Closed}
      data-dialog="Booking"
      aria-labelledby="booking-dialog-title"
    >
      <div class="section-heading">
        <div class="section-heading">
          <h2 id="booking-dialog-title">Booking details</h2>
          <gymtime-help-tip topic="changes"></gymtime-help-tip>
        </div>
        <button data-intent=${i.CloseDialog} value="Booking">Close</button>
      </div>
      ${s
        ? s.bookings
            .filter((booking) => booking.id === v.activeBooking)
            .map((booking) => bookingCard(v, booking, s))
        : nothing}
    </dialog>
    <dialog
      id="slot-dialog"
      ?modal=${v.dialog === "Slot"}
      data-intent-close=${i.Closed}
      data-dialog="Slot"
      aria-labelledby="slot-dialog-title"
    >
      <div class="section-heading">
        <h2 id="slot-dialog-title">Gym time unavailable</h2>
        <button data-intent=${i.CloseDialog} value="Slot">
          Close availability
        </button>
      </div>
      ${s
        ? s.slots
            .filter((slot) => slot.id === v.activeSlot)
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
    <dialog
      id="selection-dialog"
      ?modal=${v.dialog === "Selection"}
      data-intent-close=${i.Closed}
      data-dialog="Selection"
      aria-label="Review selected times"
    >
      <button data-intent=${i.CloseDialog} value="Selection">
        Close review</button
      >${s && v.selectionOpen ? requestForm(v, s, "dialog") : nothing}
    </dialog>
    <dialog
      id="confirm-dialog"
      ?modal=${v.dialog === "Confirm"}
      data-intent-close=${i.Closed}
      data-dialog="Confirm"
      aria-labelledby="confirm-title"
      data-intent-cancel=${i.Dismiss}
    >
      <h2 id="confirm-title">
        ${v.previewValue ? "Review affected dates" : "Confirm schedule change"}
      </h2>
      <p>${v.confirmation}</p>
      ${v.pending?.operation === "close_gym"
        ? html`<p>
              ${v.pending.start_date} ${v.pending.start} – ${v.pending.end_date}
              ${v.pending.end} · ${spaceLabel(v.pending.space)}
            </p>
            <p>Reason: ${v.pending.reason}</p>`
        : nothing}${v.previewValue
        ? html`${v.previewValue.occurrences.length
            ? html`<ul>
                ${v.previewValue.occurrences.map(
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
                ${v.previewValue.affected_bookings.length} confirmed booking(s)
                and ${v.previewValue.affected_requests.length} pending
                request(s).
              </p>`}`
        : nothing}${review(v, v.pending, s)}${v.excluded.length
        ? html`<h3>Excluded recurring dates</h3>
            <ul>
              ${v.excluded.map((d) => html`<li>${d.date}: ${d.reason}</li>`)}
            </ul>`
        : nothing}
      <div class="actions">
        <button data-intent=${i.Dismiss}>Go back</button
        ><button
          class="primary"
          ?disabled=${v.previewValue?.occurrences.some((o) =>
            Boolean(o.error),
          ) ||
          v.busy ||
          (v.pending?.operation === "create_slots" &&
            v.previewValue?.occurrences.length === 0)}
          data-intent=${i.Confirm}
        >
          Confirm and save
        </button>
      </div>
    </dialog>
  </div>`;
};
