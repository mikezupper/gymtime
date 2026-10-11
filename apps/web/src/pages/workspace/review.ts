import { html, nothing, type ChildValue } from "@gyral/core";
import { slotLabel } from "../../components/planner-forms.js";
import {
  slotsConflict,
  type Schedule,
  type ScheduleAction,
} from "../../domain/schedule.js";
import { describeBooking, teamName } from "./helpers.js";
import type { WorkspaceView } from "./model.js";
export const review = (
  v: WorkspaceView,
  action: ScheduleAction | undefined,
  s: Schedule | undefined,
): ChildValue => {
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
        ${affected.map((b) => html`<li>${describeBooking(v, b)}</li>`)}
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
    return html`<p>Team: ${teamName(v, action.team)}</p>
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
                Will cancel competing request: ${teamName(v, request.team)} ·
                ${slot ? slotLabel(slot) : "Unknown date"}
              </p>`;
            })
        : nothing}`;
  if (action.operation === "withdraw_requests")
    return html`<ul>
      ${action.ids.map((id) => {
        const r = s.requests.find((r) => r.id === id);
        const slot = s.slots.find((slot) => slot.id === r?.slot);
        return html`<li>
          ${r ? teamName(v, r.team) : "Team"} ·
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
            ${r ? teamName(v, r.team) : "Team"}:
            ${slot ? slotLabel(slot) : "Unknown date"} ·
            ${d.approve ? "Approve" : "Decline"}
          </li>`;
        })}
      </ul>
      ${s.requests
        .filter(
          (request) =>
            request.status === "pending" &&
            !action.decisions.some((decision) => decision.id === request.id) &&
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
                          (b) => b.id === approved.slot && slotsConflict(a, b),
                        ),
                    ),
                ),
            ),
        )
        .map((request) => {
          const slot = s.slots.find((slot) => slot.id === request.slot);
          return html`<p class="status small">
            Will cancel competing request: ${teamName(v, request.team)} ·
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
    return html`<p>${first ? describeBooking(v, first) : "Unknown booking"}</p>
      <p>↔ ${second ? describeBooking(v, second) : "Unknown booking"}</p>`;
  }
  if (action.operation === "close_gym" && v.previewValue)
    return html`<ul>
      ${v.previewValue.affected_bookings.map((id) => {
        const b = s.bookings.find((b) => b.id === id);
        return html`<li>
          ${b ? describeBooking(v, b) : "Booking"} · will be cancelled
        </li>`;
      })}${v.previewValue.affected_requests.map((id) => {
        const r = s.requests.find((r) => r.id === id);
        const slot = s.slots.find((slot) => slot.id === r?.slot);
        return html`<li>
          Pending ${r ? teamName(v, r.team) : "request"} ·
          ${slot ? slotLabel(slot) : ""} · will be cancelled
        </li>`;
      })}
    </ul>`;
  return nothing;
};
