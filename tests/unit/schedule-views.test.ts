import { expect, it } from "vitest";
import { FastCheck } from "effect";
import {
  reviewGroups,
  weeklyPatterns,
} from "../../apps/web/src/domain/schedule-views.js";
import type {
  Request,
  Schedule,
  Slot,
} from "../../apps/web/src/domain/schedule.js";
const slot = (
  id: number,
  date: string,
  space: Slot["space"] = "full",
): Slot => ({
  id,
  season: 1,
  date,
  start: "16:00",
  end: "17:00",
  starts_at: Date.parse(`${date}T16:00:00Z`),
  ends_at: Date.parse(`${date}T17:00:00Z`),
  space,
  available: true,
  enabled: true,
  version: 1,
});
const request = (
  id: number,
  team: number,
  slot: number,
  series: string | null = null,
): Request => ({
  id,
  team,
  slot,
  series,
  activity: "practice",
  note: "",
  reason: "",
  replacement: null,
  status: "pending",
  version: 1,
});
const schedule = (
  slots: ReadonlyArray<Slot>,
  requests: ReadonlyArray<Request> = [],
): Schedule => ({
  gym: { name: "School", timezone: "UTC", split: true, version: 1, hours: [] },
  seasons: [
    {
      id: 1,
      name: "Winter",
      start_date: "2027-01-01",
      end_date: "2027-01-31",
      status: "active",
      version: 1,
    },
  ],
  teams: [],
  slots,
  requests,
  bookings: [],
  swaps: [],
  closures: [],
  now: 0,
});
it("groups full-gym competitions but preserves compatible halves and recurring dates", () => {
  const s = schedule([
    slot(1, "2027-01-04", "half_a"),
    slot(2, "2027-01-04", "half_b"),
    slot(3, "2027-01-04"),
    slot(4, "2027-01-11", "half_b"),
  ]);
  const compatible = [
    request(1, 1, 1),
    request(2, 2, 2, "series"),
    request(3, 2, 4, "series"),
  ];
  expect(
    reviewGroups(s, compatible).map((group) => group.requests.length),
  ).toEqual([1, 2]);
  const competing = reviewGroups(s, [...compatible, request(4, 3, 3)]);
  expect(competing).toHaveLength(1);
  expect(competing[0]?.competing).toBe(true);
  expect(competing[0]?.requests).toHaveLength(4);
});
it("separate change proposals on the same original series retain their intent; mixed decisions retain all dates", () => {
  const s = schedule([
    slot(1, "2027-01-04"),
    slot(2, "2027-01-11"),
    slot(3, "2027-01-18"),
  ]);
  const requests = [
    {
      ...request(1, 1, 1, "original"),
      replacement: 10,
      note: "One extra practice",
    },
    {
      ...request(2, 1, 2, "original"),
      replacement: 11,
      note: "Move later dates",
    },
    {
      ...request(3, 1, 3, "original"),
      replacement: 12,
      note: "Move later dates",
      status: "declined" as const,
    },
  ];
  const groups = reviewGroups(s, requests);
  expect(groups).toHaveLength(2);
  expect(groups[1]?.requests.map((r) => r.status)).toEqual([
    "pending",
    "declined",
  ]);
});
it("expands multiple weekly patterns without duplicate dates and names missing and closed occurrences", () => {
  const slots = [
    slot(1, "2027-01-04", "half_a"),
    slot(2, "2027-01-06", "half_a"),
    slot(3, "2027-01-11", "half_a"),
    { ...slot(4, "2027-01-13", "half_a"), available: false },
    slot(5, "2027-01-20", "half_a"),
  ];
  const result = weeklyPatterns(schedule(slots), [1, 2, 3], "2027-01-20");
  expect(result.slots).toEqual([1, 2, 3, 5]);
  expect(result.excluded.map((value) => value.date)).toEqual([
    "2027-01-18",
    "2027-01-13",
  ]);
});
it("review grouping preserves every request once and is independent of input order", () => {
  const s = schedule([
    slot(1, "2027-01-04", "half_a"),
    slot(2, "2027-01-04", "half_b"),
    slot(3, "2027-01-04"),
    slot(4, "2027-01-11"),
  ]);
  FastCheck.assert(
    FastCheck.property(
      FastCheck.array(
        FastCheck.record({
          team: FastCheck.integer({ min: 1, max: 3 }),
          slot: FastCheck.integer({ min: 1, max: 4 }),
          series: FastCheck.option(FastCheck.constant("series"), { nil: null }),
        }),
        { maxLength: 30 },
      ),
      (values) => {
        const requests = values.map((value, index) =>
          request(index + 1, value.team, value.slot, value.series),
        );
        const ids = (items: ReadonlyArray<Request>) =>
          reviewGroups(s, items)
            .map((group) =>
              group.requests.map((r) => r.id).sort((a, b) => a - b),
            )
            .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
        expect(
          ids(requests)
            .flat()
            .sort((a, b) => a - b),
        ).toEqual(requests.map((r) => r.id));
        expect(ids(requests)).toEqual(ids([...requests].reverse()));
      },
    ),
    { seed: 426, numRuns: 150 },
  );
});
