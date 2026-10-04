import { afterEach, expect, it } from "vitest";
import "../../apps/web/src/components/gymtime-calendar.js";
import type { Schedule, Slot } from "../../apps/web/src/domain/schedule.js";
const slot: Slot = {
  id: 1,
  season: 1,
  date: "2027-01-04",
  start: "16:07",
  end: "17:07",
  starts_at: 100,
  ends_at: 200,
  space: "half_a",
  enabled: true,
  available: false,
  version: 1,
};
const schedule: Schedule = {
  gym: {
    name: "School Gym",
    timezone: "UTC",
    split: true,
    version: 1,
    hours: [],
  },
  seasons: [],
  teams: [
    {
      id: 1,
      name: "School 6th Grade Boys Basketball",
      primary: 1,
      assistants: [],
      seasons: [1],
      share_token: null,
      version: 1,
    },
  ],
  slots: [
    slot,
    { ...slot, id: 2, space: "full" },
    { ...slot, id: 3, space: "half_b", available: true },
  ],
  bookings: [
    {
      id: 1,
      team: 1,
      slot: 1,
      activity: "practice",
      note: "Internal",
      series: null,
      status: "confirmed",
      version: 1,
    },
    {
      id: 2,
      team: 1,
      slot: 1,
      activity: "game",
      note: "",
      series: null,
      status: "coach_cancelled",
      version: 2,
    },
  ],
  requests: [],
  swaps: [],
  closures: [],
  now: 0,
};
afterEach(() => document.body.replaceChildren());
it("shows actual half-gym occupancy once, with compatible availability and no cancelled history", async () => {
  const host = document.createElement("gymtime-calendar");
  host.schedule = schedule;
  host.season = 1;
  host.week = slot.date;
  host.day = slot.date;
  host.canSelect = true;
  document.body.append(host);
  await host.updateComplete;
  const events = host.shadowRoot?.querySelectorAll(".event.booked");
  expect(events).toHaveLength(1);
  expect(events?.[0]?.textContent).toContain("Half A");
  expect(events?.[0]?.textContent).not.toContain("Full gym");
  expect(host.shadowRoot?.querySelectorAll(".event.free")).toHaveLength(1);
  expect(host.shadowRoot?.querySelector(".event.free")?.textContent).toContain(
    "Half B",
  );
  expect(host.shadowRoot?.querySelector(".event.closed")).toBeNull();
  let selected = 0;
  host.addEventListener("booking-open", (event) => {
    if (event instanceof CustomEvent && typeof event.detail === "number")
      selected = event.detail;
  });
  host.shadowRoot?.querySelector<HTMLButtonElement>(".event.booked")?.click();
  expect(selected).toBe(1);
});
it("assistant calendars keep availability inspectable without offering mutation actions", async () => {
  const host = document.createElement("gymtime-calendar");
  host.schedule = schedule;
  host.season = 1;
  host.week = slot.date;
  host.day = slot.date;
  host.canSelect = false;
  document.body.append(host);
  await host.updateComplete;
  expect(
    host.shadowRoot?.querySelector<HTMLButtonElement>(".event.free")?.disabled,
  ).toBe(true);
  expect(
    host.shadowRoot?.querySelector<HTMLButtonElement>(".event.booked")
      ?.disabled,
  ).toBe(false);
});
