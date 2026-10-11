import type { Schedule } from "../domain/schedule.js";
import {
  each,
  type ChildValue,
  css,
  define,
  html,
  nothing,
  outputs,
  prop,
  type PropsOf,
  type TemplateResult,
} from "@gyral/core";
import {
  clockLabel,
  minutes,
  pendingAt,
  shortTeam,
  timeRange,
} from "../domain/schedule-views.js";
import {
  dateLabel,
  shiftDate,
  slotsConflict,
  spaceLabel,
  type Booking,
  type Slot,
} from "../domain/schedule.js";
import { plannerStyles } from "./planner-styles.js";
import { idFrom, numbersProp, scheduleProp } from "./props.js";
const props = {
  schedule: scheduleProp(),
  season: prop.number({ default: 0 }),
  week: prop.string({ default: "" }),
  day: prop.string({ default: "" }),
  teams: numbersProp(),
  allTeams: prop.boolean({ default: true }),
  canSelect: prop.boolean(),
  busy: prop.boolean(),
};
type Props = PropsOf<typeof props>;
interface State {
  readonly allHours: boolean;
  readonly mode: "week" | "day" | "list";
}
export type CalendarOutput =
  | { readonly _tag: "Booking"; readonly id: number }
  | { readonly _tag: "Time"; readonly id: number }
  | { readonly _tag: "Slot"; readonly id: number }
  | { readonly _tag: "Day"; readonly date: string }
  | { readonly _tag: "Shift"; readonly days: number }
  | { readonly _tag: "Today" };
type Msg =
  | CalendarOutput
  | { readonly _tag: "Mode"; readonly mode: State["mode"] }
  | { readonly _tag: "Hours"; readonly all: boolean };
const emit = outputs<CalendarOutput>();
const teamName = (p: Props, id: number) =>
  shortTeam(p.schedule?.teams.find((t) => t.id === id)?.name ?? "Team");
const bookings = (p: Props, date: string): ReadonlyArray<Booking> => {
  const s = p.schedule;
  return (
    s?.bookings.filter(
      (b) =>
        b.status === "confirmed" &&
        (p.allTeams || p.teams.includes(b.team)) &&
        s.slots.some(
          (slot) =>
            slot.id === b.slot &&
            slot.season === p.season &&
            slot.date === date,
        ),
    ) ?? []
  );
};
const available = (p: Props, date: string): ReadonlyArray<Slot> => {
  const s = p.schedule;
  if (!s || !p.allTeams) return [];
  const available = s.slots.filter(
    (slot) => slot.season === p.season && slot.date === date && slot.available,
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
};
const position = (slot: Slot, first: number) => {
  return `
      grid-row:${Math.max(0, minutes(slot.start) - first) + 1} / ${Math.max(Math.max(0, minutes(slot.start) - first) + 2, minutes(slot.end) - first + 1)};
      grid-column:${slot.space === "full" ? "1 / 3" : slot.space === "half_a" ? "1" : "2"};`;
};
const agenda = (
  p: Props,
  dates: ReadonlyArray<string>,
  force = false,
): TemplateResult | typeof nothing => {
  const i = calendarIntents;
  const s = p.schedule;
  if (!s) return nothing;
  return html`<div class=${force ? "agenda force" : "agenda"}>
    ${dates.map(
      (date) =>
        html`<section class="agenda-day" aria-label=${dateLabel(date)}>
          <h3>${dateLabel(date)}</h3>
          ${each(
            bookings(p, date),
            (booking) => booking.id,
            agendaBooking,
            () => ({ p, s, i }),
          )}${each(
            available(p, date),
            (slot) => slot.id,
            agendaAvailable,
            () => ({ p, s, i }),
          )}${each(
            s.slots
              .filter(
                (slot) =>
                  slot.date === date &&
                  slot.season === p.season &&
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
              .slice(0, 8),
            (slot) => slot.id,
            agendaUnavailable,
            () => ({ i }),
          )}${!bookings(p, date).length &&
          !s.slots.some(
            (slot) => slot.date === date && slot.season === p.season,
          )
            ? html`<p class="muted">No published times.</p>`
            : nothing}
        </section>`,
    )}
  </div>`;
};
const calendarIntents = {
  Booking: "Booking",
  Time: "Time",
  Slot: "Slot",
  Shift: "Shift",
  Today: "Today",
  Mode: "Mode",
  Day: "Day",
  Hours: "Hours",
} as const;
export const GymtimeCalendar = define<State, Msg, Props, CalendarOutput>()(
  "gymtime-calendar",
  {
    props,
    init: () => ({ allHours: false, mode: "week" }),
    styles: [
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
          --hour-height: 7rem;
          display: grid;
          grid-template-columns: 3.5rem repeat(var(--days), minmax(0, 1fr));
          min-inline-size: 60rem;
        }
        .timeline.single {
          min-inline-size: 0;
        }
        .axis {
          display: grid;
          grid-template-rows: 2.7rem repeat(var(--hours), var(--hour-height));
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
          block-size: calc(var(--hours) * var(--hour-height));
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(var(--rows), minmax(0, 1fr));
          background: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent calc(var(--hour-height) - 1px),
            var(--border) calc(var(--hour-height) - 1px),
            var(--border) var(--hour-height)
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
    ],
    intent: {
      Booking: ({ value }) => {
        const id = idFrom(value);
        return id ? { _tag: "Booking", id } : undefined;
      },
      Time: ({ value }) => {
        const id = idFrom(value);
        return id ? { _tag: "Time", id } : undefined;
      },
      Slot: ({ value }) => {
        const id = idFrom(value);
        return id ? { _tag: "Slot", id } : undefined;
      },
      Shift: ({ value }) =>
        [-7, -1, 1, 7].includes(Number(value))
          ? { _tag: "Shift", days: Number(value) }
          : undefined,
      Today: true,
      Day: ({ value }) =>
        value && /^\d{4}-\d{2}-\d{2}$/.test(value)
          ? { _tag: "Day", date: value }
          : undefined,
      Mode: ({ value }) =>
        value === "week" || value === "day" || value === "list"
          ? { _tag: "Mode", mode: value }
          : undefined,
      Hours: ({ value }) => ({ _tag: "Hours", all: value === "all" }),
    },
    update: {
      Booking: (s, m) => [s, [emit(m)]],
      Time: (s, m, { props: p }) =>
        !p.canSelect || p.busy ? s : [s, [emit(m)]],
      Slot: (s, m) => [s, [emit(m)]],
      Shift: (s, m) => [s, [emit(m)]],
      Today: (s, m) => [s, [emit(m)]],
      Day: (s, m) => [s, [emit(m)]],
      Mode: (s, m) => ({ ...s, mode: m.mode }),
      Hours: (s, m) => ({ ...s, allHours: m.all }),
    },
    view: (state, i, { props: p }) => {
      const s = p.schedule;
      if (!s || !p.week) return nothing;
      const days = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
        shiftDate(p.week, offset),
      );
      const chosen = days.includes(p.day) ? p.day : p.week;
      const dates = state.mode === "day" ? [chosen] : days;
      const slots = s.slots.filter(
        (slot) => slot.season === p.season && dates.includes(slot.date),
      );
      const earliest = slots.length
        ? Math.floor(
            Math.min(...slots.map((slot) => minutes(slot.start))) / 60,
          ) * 60
        : 9 * 60;
      const lateWeek =
        slots.some((slot) => minutes(slot.start) >= 16 * 60) &&
        earliest < 16 * 60;
      const first =
        state.mode === "week" && !state.allHours && lateWeek
          ? 16 * 60
          : earliest;
      const earlierBookings = dates
        .flatMap((date) => bookings(p, date))
        .filter((booking) =>
          s.slots.some(
            (slot) => slot.id === booking.slot && minutes(slot.start) < first,
          ),
        );
      const last = slots.length
        ? Math.ceil(Math.max(...slots.map((slot) => minutes(slot.end))) / 60) *
          60
        : 21 * 60;
      const hours = Math.max(1, (last - first) / 60);
      return html`<div class="tools actions">
          <div class="actions">
            <button
              data-intent=${i.Shift}
              value=${state.mode === "day" ? -1 : -7}
              aria-label=${state.mode === "day"
                ? "Previous day"
                : "Previous week"}
            >
              ‹</button
            ><strong
              >${state.mode === "day"
                ? dateLabel(chosen)
                : `${dateLabel(p.week)} – ${dateLabel(shiftDate(p.week, 6))}`}</strong
            ><button
              data-intent=${i.Shift}
              value=${state.mode === "day" ? 1 : 7}
              aria-label=${state.mode === "day" ? "Next day" : "Next week"}
            >
              ›</button
            ><button data-intent=${i.Today}>Today</button>
          </div>
          <div class="actions desktop-views" aria-label="Calendar view">
            ${(["day", "week", "list"] as const).map(
              (mode) =>
                html`<button
                  aria-pressed=${state.mode === mode}
                  data-intent=${i.Mode}
                  value=${mode}
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
                data-intent=${i.Day}
                value=${date}
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
              <button data-intent=${i.Hours} value="all">Show all hours</button>
            </p>`
          : nothing}${state.mode === "week" && lateWeek && state.allHours
          ? html`<button data-intent=${i.Hours} value="afternoon">
              Show afternoon hours
            </button>`
          : nothing}
        ${state.mode !== "list"
          ? html`<div
              class=${state.mode === "day"
                ? "week-scroll day-view"
                : "week-scroll"}
            >
              <div
                class=${state.mode === "day" ? "timeline single" : "timeline"}
                style="--days: ${dates.length}; --hours: ${hours}; --rows: ${hours *
                60}"
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
                        ${each(
                          bookings(p, date).filter((booking) =>
                            s.slots.some(
                              (slot) =>
                                slot.id === booking.slot &&
                                minutes(slot.end) > first,
                            ),
                          ),
                          (booking) => booking.id,
                          gridBooking,
                          () => ({ p, s, date, first, i }),
                        )}${each(
                          available(p, date).filter(
                            (slot) => minutes(slot.start) >= first,
                          ),
                          (slot) => slot.id,
                          gridAvailable,
                          () => ({ p, s, date, first, i }),
                        )}${each(
                          s.slots
                            .filter(
                              (slot) =>
                                slot.date === date &&
                                slot.season === p.season &&
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
                            ),
                          (slot) => slot.id,
                          gridUnavailable,
                          () => ({ first, i }),
                        )}
                      </div>
                    </div>`,
                )}
              </div>
            </div>`
          : nothing}
        ${state.mode !== "day"
          ? agenda(
              p,
              state.mode === "list" ? days : [chosen],
              state.mode === "list",
            )
          : nothing}
        <p class="legend">
          Solid: confirmed booking · Dashed: published availability · Pending
          requests do not reserve time. ${s.gym.timezone}
        </p>`;
    },
  },
);

const agendaBooking = (
  booking: Booking,
  {
    p,
    s,
    i,
  }: {
    readonly p: Props;
    readonly s: Schedule;
    readonly i: {
      readonly Booking: string;
      readonly Time: string;
      readonly Slot: string;
    };
  },
): ChildValue => {
  const slot = s.slots.find((slot) => slot.id === booking.slot);
  return slot
    ? html`<button
        class="agenda-row"
        data-intent=${i.Booking}
        value=${booking.id}
      >
        <span
          ><strong>${timeRange(slot)} · ${teamName(p, booking.team)}</strong
          ><small
            >${spaceLabel(slot.space)} · ${booking.activity} · Confirmed</small
          ></span
        ><span aria-hidden="true">›</span>
      </button>`
    : nothing;
};
const agendaAvailable = (
  slot: Slot,
  {
    p,
    s,
    i,
  }: {
    readonly p: Props;
    readonly s: Schedule;
    readonly i: {
      readonly Booking: string;
      readonly Time: string;
      readonly Slot: string;
    };
  },
): ChildValue =>
  html`<button
    class="agenda-row"
    ?disabled=${!p.canSelect || p.busy}
    data-intent=${i.Time}
    value=${slot.id}
  >
    <span
      ><strong>${timeRange(slot)}</strong
      ><small
        >${spaceLabel(slot.space)} ·
        Available${pendingAt(s, slot).length ? " · request pending" : ""}</small
      ></span
    ><span>Choose</span>
  </button>`;
const agendaUnavailable = (
  slot: Slot,
  {
    i,
  }: {
    readonly i: {
      readonly Booking: string;
      readonly Time: string;
      readonly Slot: string;
    };
  },
): ChildValue =>
  html`<button class="agenda-row muted" data-intent=${i.Slot} value=${slot.id}>
    ${timeRange(slot)} · ${spaceLabel(slot.space)} · Unavailable · Details
  </button>`;
const gridBooking = (
  booking: Booking,
  {
    p,
    s,
    date,
    first,
    i,
  }: {
    readonly p: Props;
    readonly s: Schedule;
    readonly date: string;
    readonly first: number;
    readonly i: {
      readonly Booking: string;
      readonly Time: string;
      readonly Slot: string;
    };
  },
): ChildValue => {
  const slot = s.slots.find((slot) => slot.id === booking.slot);
  return slot
    ? html`<button
        class="event booked"
        style=${position(slot, first)}
        aria-label=${`${teamName(p, booking.team)} · ${dateLabel(date)} · ${timeRange(slot)} · ${spaceLabel(slot.space)} · ${booking.activity} · Confirmed`}
        data-intent=${i.Booking}
        value=${booking.id}
      >
        <strong>${teamName(p, booking.team)}</strong
        ><span>${timeRange(slot)}</span
        ><span>${spaceLabel(slot.space)} · ${booking.activity}</span>
      </button>`
    : nothing;
};
const gridAvailable = (
  slot: Slot,
  {
    p,
    s,
    date,
    first,
    i,
  }: {
    readonly p: Props;
    readonly s: Schedule;
    readonly date: string;
    readonly first: number;
    readonly i: {
      readonly Booking: string;
      readonly Time: string;
      readonly Slot: string;
    };
  },
): ChildValue =>
  html`<button
    class="event free"
    style=${position(slot, first)}
    ?disabled=${!p.canSelect || p.busy}
    data-intent=${i.Time}
    value=${slot.id}
    aria-label=${`Choose ${dateLabel(date)} · ${timeRange(slot)} · ${spaceLabel(slot.space)} · Available${pendingAt(s, slot).length ? " · request pending" : ""}`}
  >
    <strong>Available</strong><span>${timeRange(slot)}</span
    ><span
      >${spaceLabel(slot.space)}${pendingAt(s, slot).length
        ? " · Pending"
        : ""}</span
    >
  </button>`;
const gridUnavailable = (
  slot: Slot,
  {
    first,
    i,
  }: {
    readonly first: number;
    readonly i: {
      readonly Booking: string;
      readonly Time: string;
      readonly Slot: string;
    };
  },
): ChildValue =>
  html`<button
    data-intent=${i.Slot}
    value=${slot.id}
    class="event closed"
    style=${position(slot, first)}
  >
    <strong>Unavailable</strong><span>${spaceLabel(slot.space)}</span>
  </button>`;
