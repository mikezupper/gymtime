import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  dateLabel,
  shiftDate,
  spaceLabel,
  slotsConflict,
  type Schedule,
  type Slot,
  type Booking,
} from "../domain/schedule.js";
import {
  clockLabel,
  minutes,
  pendingAt,
  shortTeam,
  timeRange,
} from "../domain/schedule-views.js";
import { plannerStyles } from "./planner-styles.js";

@customElement("gymtime-calendar")
export class GymtimeCalendar extends LitElement {
  @property({ attribute: false }) schedule?: Schedule;
  @property({ type: Number }) season = 0;
  @property() week = "";
  @property() day = "";
  @property({ attribute: false }) teams: ReadonlyArray<number> = [];
  @property({ type: Boolean }) allTeams = true;
  @property({ type: Boolean }) canSelect = false;
  @property({ type: Boolean }) busy = false;
  @state() private allHours = false;
  @state() private mode: "week" | "day" | "list" = "week";
  static override styles = [
    plannerStyles,
    css`
      .tools {
        justify-content: space-between;
        margin-block-end: 1rem;
      }
      .date-strip {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.25rem;
        margin-block-end: 1rem;
      }
      .date-strip button {
        padding: 0.45rem 0.15rem;
        font-size: 0.85rem;
      }
      [aria-pressed="true"] {
        border-color: var(--accent);
        background: var(--accent-subtle);
        font-weight: 650;
      }
      .week-scroll {
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        background: var(--surface-raised);
      }
      .timeline {
        display: grid;
        grid-template-columns: 3.5rem repeat(var(--days), minmax(0, 1fr));
        min-inline-size: 40rem;
      }
      .timeline.single {
        min-inline-size: 0;
      }
      .axis {
        display: grid;
        grid-template-rows: 2.7rem repeat(var(--hours), 60px);
        font-size: 0.75rem;
        color: var(--muted);
        text-align: end;
      }
      .axis span {
        padding-inline: 0.35rem;
        padding-block-start: 0.25rem;
      }
      .column {
        min-inline-size: 0;
        border-inline-start: 1px solid var(--border);
      }
      .column h3 {
        block-size: 2.7rem;
        display: grid;
        place-content: center;
        font-size: 0.85rem;
        border-block-end: 1px solid var(--border);
      }
      .lanes {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(var(--rows), 1px);
        background: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent 59px,
          var(--border) 59px,
          var(--border) 60px
        );
      }
      .event {
        min-block-size: 0;
        min-inline-size: 0;
        margin: 2px;
        padding: 0.25rem 0.35rem;
        text-align: start;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        overflow: auto;
        border-radius: 0.35rem;
        font-size: 0.73rem;
        line-height: 1.3;
      }
      .event.booked {
        background: var(--accent-subtle);
        border-inline-start: 3px solid var(--accent);
      }
      .event.free {
        border-style: dashed;
        color: var(--muted);
        background: var(--surface-raised);
      }
      .event.closed {
        background: var(--surface);
        border-style: dashed;
      }
      .event strong {
        font-size: 0.8rem;
      }
      .agenda {
        display: none;
      }
      .agenda.force {
        display: block;
      }
      .agenda-day {
        margin-block: 0 1rem;
        gap: 0.5rem;
      }
      .agenda-day h3 {
        font-size: 0.95rem;
        padding-block: 0.5rem;
      }
      .agenda-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.7rem;
        padding: 0.8rem;
        inline-size: 100%;
        text-align: start;
      }
      .agenda-row span {
        display: grid;
        gap: 0.15rem;
      }
      .agenda-row small {
        color: var(--muted);
      }
      .legend {
        margin-block: 0.65rem;
        font-size: 0.8rem;
        color: var(--muted);
      }
      @container (max-width:45rem) {
        .week-scroll:not(.day-view) {
          display: none;
        }
        .agenda {
          display: block;
        }
        .date-strip button span {
          display: block;
        }
        .tools {
          gap: 0.5rem;
        }
        .desktop-views {
          display: none;
        }
      }
    `,
  ];
  private emit(name: string, detail: number | string) {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    );
  }
  private teamName(id: number) {
    return shortTeam(
      this.schedule?.teams.find((team) => team.id === id)?.name ?? "Team",
    );
  }
  private bookings(date: string): ReadonlyArray<Booking> {
    const s = this.schedule;
    return (
      s?.bookings.filter(
        (b) =>
          b.status === "confirmed" &&
          (this.allTeams || this.teams.includes(b.team)) &&
          s.slots.some(
            (slot) =>
              slot.id === b.slot &&
              slot.season === this.season &&
              slot.date === date,
          ),
      ) ?? []
    );
  }
  private available(date: string): ReadonlyArray<Slot> {
    const s = this.schedule;
    if (!s || !this.allTeams) return [];
    const available = s.slots.filter(
      (slot) =>
        slot.season === this.season && slot.date === date && slot.available,
    );
    return available.filter(
      (slot) =>
        slot.space === "full" ||
        !available.some(
          (full) =>
            full.space === "full" &&
            full.start === slot.start &&
            full.end === slot.end,
        ),
    );
  }
  private position(slot: Slot, first: number) {
    return styleMap({
      gridRow: `${Math.max(0, minutes(slot.start) - first) + 1} / ${Math.max(Math.max(0, minutes(slot.start) - first) + 2, minutes(slot.end) - first + 1)}`,
      gridColumn:
        slot.space === "full" ? "1 / 3" : slot.space === "half_a" ? "1" : "2",
    });
  }
  private agenda(dates: ReadonlyArray<string>, force = false) {
    const s = this.schedule;
    if (!s) return nothing;
    return html`<div class=${force ? "agenda force" : "agenda"}>
      ${dates.map(
        (date) =>
          html`<section class="agenda-day" aria-label=${dateLabel(date)}>
            <h3>${dateLabel(date)}</h3>
            ${this.bookings(date).map((booking) => {
              const slot = s.slots.find((slot) => slot.id === booking.slot);
              return slot
                ? html`<button
                    class="agenda-row"
                    @click=${() => this.emit("booking-open", booking.id)}
                  >
                    <span
                      ><strong
                        >${timeRange(slot)} ·
                        ${this.teamName(booking.team)}</strong
                      ><small
                        >${spaceLabel(slot.space)} · ${booking.activity} ·
                        Confirmed</small
                      ></span
                    ><span aria-hidden="true">›</span>
                  </button>`
                : nothing;
            })}${this.available(date).map(
              (slot) =>
                html`<button
                  class="agenda-row"
                  ?disabled=${!this.canSelect || this.busy}
                  @click=${() => this.emit("time-open", slot.id)}
                >
                  <span
                    ><strong>${timeRange(slot)}</strong
                    ><small
                      >${spaceLabel(slot.space)} ·
                      Available${pendingAt(s, slot).length
                        ? " · request pending"
                        : ""}</small
                    ></span
                  ><span>Choose</span>
                </button>`,
            )}${s.slots
              .filter(
                (slot) =>
                  slot.date === date &&
                  slot.season === this.season &&
                  !slot.available &&
                  !s.bookings.some(
                    (booking) =>
                      booking.status === "confirmed" &&
                      s.slots.some(
                        (other) =>
                          other.id === booking.slot &&
                          slotsConflict(slot, other),
                      ),
                  ),
              )
              .slice(0, 8)
              .map(
                (slot) =>
                  html`<button
                    class="agenda-row muted"
                    @click=${() => this.emit("slot-open", slot.id)}
                  >
                    ${timeRange(slot)} · ${spaceLabel(slot.space)} · Unavailable
                    · Details
                  </button>`,
              )}${!this.bookings(date).length &&
            !s.slots.some(
              (slot) => slot.date === date && slot.season === this.season,
            )
              ? html`<p class="muted">No published times.</p>`
              : nothing}
          </section>`,
      )}
    </div>`;
  }
  override render() {
    const s = this.schedule;
    if (!s || !this.week) return nothing;
    const days = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
      shiftDate(this.week, offset),
    );
    const chosen = days.includes(this.day) ? this.day : this.week;
    const dates = this.mode === "day" ? [chosen] : days;
    const slots = s.slots.filter(
      (slot) => slot.season === this.season && dates.includes(slot.date),
    );
    const earliest = slots.length
      ? Math.floor(Math.min(...slots.map((slot) => minutes(slot.start))) / 60) *
        60
      : 9 * 60;
    const lateWeek =
      slots.some((slot) => minutes(slot.start) >= 16 * 60) &&
      earliest < 16 * 60;
    const first =
      this.mode === "week" && !this.allHours && lateWeek ? 16 * 60 : earliest;
    const earlierBookings = dates
      .flatMap((date) => this.bookings(date))
      .filter((booking) =>
        s.slots.some(
          (slot) => slot.id === booking.slot && minutes(slot.start) < first,
        ),
      );
    const last = slots.length
      ? Math.ceil(Math.max(...slots.map((slot) => minutes(slot.end))) / 60) * 60
      : 21 * 60;
    const hours = Math.max(1, (last - first) / 60);
    return html`<div class="tools actions">
        <div class="actions">
          <button
            @click=${() =>
              this.emit("week-shift", this.mode === "day" ? -1 : -7)}
            aria-label=${this.mode === "day" ? "Previous day" : "Previous week"}
          >
            ‹</button
          ><strong
            >${this.mode === "day"
              ? dateLabel(chosen)
              : `${dateLabel(this.week)} – ${dateLabel(shiftDate(this.week, 6))}`}</strong
          ><button
            @click=${() => this.emit("week-shift", this.mode === "day" ? 1 : 7)}
            aria-label=${this.mode === "day" ? "Next day" : "Next week"}
          >
            ›</button
          ><button @click=${() => this.emit("today-open", "today")}>
            Today
          </button>
        </div>
        <div class="actions desktop-views" aria-label="Calendar view">
          ${(["day", "week", "list"] as const).map(
            (mode) =>
              html`<button
                aria-pressed=${this.mode === mode}
                @click=${() => {
                  this.mode = mode;
                }}
              >
                ${mode[0]?.toUpperCase()}${mode.slice(1)}
              </button>`,
          )}
        </div>
      </div>
      <div class="date-strip" aria-label="Choose a day">
        ${days.map(
          (date) =>
            html`<button
              aria-pressed=${date === chosen}
              @click=${() => this.emit("day-open", date)}
            >
              ${dateLabel(date)}
            </button>`,
        )}
      </div>
      ${first > earliest
        ? html`<p class="legend">
            <strong
              >Earlier published times · ${earlierBookings.length} bookings,
              including morning games.</strong
            >
            <button
              @click=${() => {
                this.allHours = true;
              }}
            >
              Show all hours
            </button>
          </p>`
        : nothing}${this.mode === "week" && lateWeek && this.allHours
        ? html`<button
            @click=${() => {
              this.allHours = false;
            }}
          >
            Show afternoon hours
          </button>`
        : nothing}
      ${this.mode !== "list"
        ? html`<div
            class=${this.mode === "day"
              ? "week-scroll day-view"
              : "week-scroll"}
          >
            <div
              class=${this.mode === "day" ? "timeline single" : "timeline"}
              style=${styleMap({
                "--days": String(dates.length),
                "--hours": String(hours),
                "--rows": String(hours * 60),
              })}
            >
              <div class="axis">
                <span>Time</span>${Array.from(
                  { length: hours },
                  (_, i) =>
                    html`<span
                      >${clockLabel(`${Math.floor(first / 60) + i}:00`)}</span
                    >`,
                )}
              </div>
              ${dates.map(
                (date) =>
                  html`<div class="column">
                    <h3>${dateLabel(date)}</h3>
                    <div class="lanes">
                      ${this.bookings(date)
                        .filter((booking) =>
                          s.slots.some(
                            (slot) =>
                              slot.id === booking.slot &&
                              minutes(slot.end) > first,
                          ),
                        )
                        .map((booking) => {
                          const slot = s.slots.find(
                            (slot) => slot.id === booking.slot,
                          );
                          return slot
                            ? html`<button
                                class="event booked"
                                style=${this.position(slot, first)}
                                aria-label=${`${this.teamName(booking.team)} · ${dateLabel(date)} · ${timeRange(slot)} · ${spaceLabel(slot.space)} · ${booking.activity} · Confirmed`}
                                @click=${() =>
                                  this.emit("booking-open", booking.id)}
                              >
                                <strong>${this.teamName(booking.team)}</strong
                                ><span>${timeRange(slot)}</span
                                ><span
                                  >${spaceLabel(slot.space)} ·
                                  ${booking.activity}</span
                                >
                              </button>`
                            : nothing;
                        })}${this.available(date)
                        .filter((slot) => minutes(slot.start) >= first)
                        .map(
                          (slot) =>
                            html`<button
                              class="event free"
                              style=${this.position(slot, first)}
                              ?disabled=${!this.canSelect || this.busy}
                              @click=${() => this.emit("time-open", slot.id)}
                              aria-label=${`Choose ${dateLabel(date)} · ${timeRange(slot)} · ${spaceLabel(slot.space)} · Available${pendingAt(s, slot).length ? " · request pending" : ""}`}
                            >
                              <strong>Available</strong
                              ><span>${timeRange(slot)}</span
                              ><span
                                >${spaceLabel(slot.space)}${pendingAt(s, slot)
                                  .length
                                  ? " · Pending"
                                  : ""}</span
                              >
                            </button>`,
                        )}${s.slots
                        .filter(
                          (slot) =>
                            slot.date === date &&
                            slot.season === this.season &&
                            minutes(slot.start) >= first &&
                            !slot.available &&
                            !s.bookings.some(
                              (booking) =>
                                booking.status === "confirmed" &&
                                s.slots.some(
                                  (other) =>
                                    other.id === booking.slot &&
                                    slotsConflict(slot, other),
                                ),
                            ),
                        )
                        .filter(
                          (slot, idx, all) =>
                            !all.some(
                              (full, j) =>
                                j !== idx &&
                                full.space === "full" &&
                                full.start === slot.start &&
                                full.end === slot.end &&
                                slot.space !== "full",
                            ),
                        )
                        .map(
                          (slot) =>
                            html`<button
                              @click=${() => this.emit("slot-open", slot.id)}
                              class="event closed"
                              style=${this.position(slot, first)}
                            >
                              <strong>Unavailable</strong
                              ><span>${spaceLabel(slot.space)}</span>
                            </button>`,
                        )}
                    </div>
                  </div>`,
              )}
            </div>
          </div>`
        : nothing}
      ${this.mode !== "day"
        ? this.agenda(
            this.mode === "list" ? days : [chosen],
            this.mode === "list",
          )
        : nothing}
      <p class="legend">
        Solid: confirmed booking · Dashed: published availability · Pending
        requests do not reserve time. ${s.gym.timezone}
      </p>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "gymtime-calendar": GymtimeCalendar;
  }
}
