import { html, nothing, type ChildValue } from "@gyral/core";
import { instantLabel, type Schedule } from "../../domain/schedule.js";
import { describeBooking } from "./helpers.js";
import { workspaceIntents as i } from "./intents.js";
import type { WorkspaceView } from "./model.js";
export const swaps = (v: WorkspaceView, s: Schedule): ChildValue => {
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
      <button data-intent=${i.SwapHistory}>
        ${v.swapHistory ? "Pending swaps" : "Swap history"}
      </button>
    </div>
    <div class="cards">
      ${s.swaps
        .filter((swap) =>
          v.swapHistory ? swap.status !== "pending" : swap.status === "pending",
        )
        .filter((swap) =>
          s.bookings.some(
            (booking) =>
              (booking.id === swap.first || booking.id === swap.second) &&
              s.slots.some(
                (slot) => slot.id === booking.slot && slot.season === v.season,
              ),
          ),
        )
        .map((swap) => {
          const first = s.bookings.find((b) => b.id === swap.first);
          const second = s.bookings.find((b) => b.id === swap.second);
          const receiving =
            second &&
            s.teams.find((t) => t.id === second.team)?.primary ===
              v.session?.user_id;
          return html`<article class="card">
            <h3>Booking exchange</h3>
            <p>${first ? describeBooking(v, first) : "Unknown booking"}</p>
            <p>↔ ${second ? describeBooking(v, second) : "Unknown booking"}</p>
            <span class="badge">${swap.status}</span>
            <p class="muted">
              Accept before ${instantLabel(swap.deadline, s.gym.timezone)}
            </p>
            ${swap.status === "pending" && swap.deadline > s.now
              ? html`<div class="actions">
                  ${receiving
                    ? html`<button
                          ?disabled=${v.busy}
                          data-intent=${i.RespondSwap}
                          value=${swap.id}
                          data-accept="true"
                        >
                          Accept swap</button
                        ><button
                          ?disabled=${v.busy}
                          data-intent=${i.RespondSwap}
                          value=${swap.id}
                          data-accept="false"
                        >
                          Decline swap
                        </button>`
                    : nothing}${swap.proposer === v.session?.user_id
                    ? html`<button
                        ?disabled=${v.busy}
                        data-intent=${i.WithdrawSwap}
                        value=${swap.id}
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
};
