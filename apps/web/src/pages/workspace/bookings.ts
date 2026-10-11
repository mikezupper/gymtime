import { html, nothing, type ChildValue } from "@gyral/core";
import { formErrors } from "../../components/form-errors.js";
import {
  activityField,
  noteField,
  scopeField,
  slotLabel,
} from "../../components/planner-forms.js";
import { noIssues } from "../../components/props.js";
import { type Booking, type Schedule } from "../../domain/schedule.js";
import { describeBooking, manageable, teamName } from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
const formIssues = (v: WorkspaceView, key: string) =>
  v.errorForm === key ? (v.failure?.issues ?? noIssues) : noIssues;
export const bookingCard = (
  v: WorkspaceView,
  b: Booking,
  s: Schedule,
): ChildValue => {
  const slot = s.slots.find((slot) => slot.id === b.slot);
  const canChange =
    manageable(v, b.team) &&
    b.status === "confirmed" &&
    Boolean(
      slot &&
        slot.ends_at > s.now &&
        s.seasons.find((v) => v.id === slot.season)?.status === "active",
    );
  return html`<article class="card">
    <h3>${teamName(v, b.team)}</h3>
    <p>${slot ? slotLabel(slot) : "Unknown slot"} · ${b.activity}</p>
    <span class="badge">${b.status.replaceAll("_", " ")}</span>${b.series
      ? html`<span class="muted">Recurring booking</span>`
      : nothing}${b.note ? html`<p>${b.note}</p>` : nothing}${canChange
      ? html`<div class="actions">
            <button
              ?disabled=${v.busy}
              data-intent=${i.ChangeBooking}
              value=${b.id}
            >
              Request change
            </button>
          </div>
          <details>
            <summary>Cancel booking</summary>
            <form
              data-intent=${i.CancelBooking}
              data-form-key=${`cancel-${b.id}`}
              data-booking=${b.id}
              ${formErrors(formIssues(v, `cancel-${b.id}`))}
            >
              <fieldset ?disabled=${v.busy}>
                ${scopeField(b.series)}<button>Cancel selected dates</button>
              </fieldset>
            </form>
          </details>
          ${v.session?.organizer
            ? html`<details
                data-intent=${i.Editor}
                data-editor=${`move-${b.id}`}
                data-intent-on="toggle"
              >
                <summary>Organizer: change booking directly</summary>
                ${v.openedBookingForms.includes(`move-${b.id}`)
                  ? html`<form
                      data-intent=${i.MoveBooking}
                      data-form-key=${`move-${b.id}`}
                      data-booking=${b.id}
                      ${formErrors(formIssues(v, `move-${b.id}`))}
                    >
                      <fieldset ?disabled=${v.busy}>
                        <label
                          >Replacement date<input
                            type="date"
                            value=${v.editDates[`booking-${b.id}`] ??
                            slot?.date ??
                            ""}
                            data-intent=${i.EditDate}
                            data-record=${`booking-${b.id}`} /></label
                        ><label
                          >Replacement slot<select name="slot" required>
                            ${s.slots
                              .filter(
                                (slot) =>
                                  slot.season === v.season &&
                                  slot.date ===
                                    (v.editDates[`booking-${b.id}`] ??
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
                        >${activityField(b.activity)}${noteField(b.note)}<button>
                          Save booking change
                        </button>
                      </fieldset>
                    </form>`
                  : nothing}
              </details>`
            : nothing}${s.teams.find((t) => t.id === b.team)?.primary ===
            v.session?.user_id && Boolean(slot && slot.starts_at > s.now)
            ? html`<details
                data-intent=${i.Editor}
                data-editor=${`swap-${b.id}`}
                data-intent-on="toggle"
              >
                <summary>Propose a swap</summary>
                ${v.openedBookingForms.includes(`swap-${b.id}`)
                  ? html`<form
                      data-intent=${i.ProposeSwap}
                      data-form-key=${`swap-${b.id}`}
                      data-booking=${b.id}
                      ${formErrors(formIssues(v, `swap-${b.id}`))}
                    >
                      <fieldset ?disabled=${v.busy}>
                        <label
                          >Swap date (optional)<input
                            type="date"
                            value=${v.swapDate}
                            data-intent=${i.TextFilter}
                            data-field="swapDate" /></label
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
                                      slot.season === v.season &&
                                      (!v.swapDate || slot.date === v.swapDate),
                                  ),
                              )
                              .map(
                                (other) =>
                                  html`<option value=${other.id}>
                                    ${describeBooking(v, other)}
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
};
