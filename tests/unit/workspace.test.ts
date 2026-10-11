import { inputsFor, step } from "@gyral/testing";
import { Either, FastCheck, Schema } from "effect";
import { expect, it } from "vitest";
import { ApiFailure, Session } from "../../apps/web/src/domain/api.js";
import {
  slotsConflict,
  type Schedule,
  type ScheduleAction,
} from "../../apps/web/src/domain/schedule.js";
import {
  workspaceInitial,
  type WorkspaceProps,
  type WorkspaceState,
} from "../../apps/web/src/pages/workspace/model.js";
import { GymtimePlanner } from "../../apps/web/src/pages/gymtime-planner.js";
import {
  saveDriver,
  scheduleDriver,
} from "../../apps/web/src/runtime/commands.js";
const props: WorkspaceProps = {
  session: Schema.decodeUnknownSync(Session)({
    user_id: 1,
    email: "organizer@example.test",
    organizer: true,
    csrf_token: "a".repeat(64),
  }),
};
const spec = GymtimePlanner.spec;
const schedule: Schedule = {
  gym: {
    name: "School Gym",
    timezone: "UTC",
    split: true,
    version: 1,
    hours: [],
  },
  seasons: [
    {
      id: 1,
      name: "Winter",
      start_date: "2027-01-01",
      end_date: "2027-02-01",
      status: "active",
      version: 1,
    },
  ],
  teams: [],
  bookings: [],
  requests: [],
  swaps: [],
  closures: [],
  now: 0,
  slots: [
    {
      id: 1,
      season: 1,
      date: "2027-01-04",
      start: "16:00",
      end: "17:00",
      starts_at: 100,
      ends_at: 200,
      space: "half_a",
      enabled: true,
      available: true,
      version: 1,
    },
    {
      id: 2,
      season: 1,
      date: "2027-01-04",
      start: "16:00",
      end: "17:00",
      starts_at: 100,
      ends_at: 200,
      space: "full",
      enabled: true,
      available: true,
      version: 1,
    },
    {
      id: 3,
      season: 1,
      date: "2027-01-04",
      start: "16:00",
      end: "17:00",
      starts_at: 100,
      ends_at: 200,
      space: "half_b",
      enabled: true,
      available: true,
      version: 1,
    },
  ],
};
const ready: WorkspaceState = {
  ...workspaceInitial,
  current: schedule,
  season: 1,
  loadStatus: "Ready",
};
const action: ScheduleAction = {
  operation: "create_season",
  name: "Next",
  start_date: "2027-03-01",
  end_date: "2027-04-01",
};
const failure = new ApiFailure({
  code: "network",
  message: "Please retry.",
  issues: [],
});
it("keeps compatible halves and replaces physically conflicting selection", () => {
  const a = step(spec, ready, { _tag: "ToggleSlot", id: 1 }, props).state;
  const b = step(spec, a, { _tag: "ToggleSlot", id: 3 }, props).state;
  expect(b.selected).toEqual([1, 3]);
  expect(
    step(spec, b, { _tag: "ToggleSlot", id: 2 }, props).state.selected,
  ).toEqual([2]);
});
it("preserves draft and selection when review is dismissed or a stale close arrives", () => {
  const state = {
    ...ready,
    selected: [1],
    dialog: "Selection" as const,
    selectionDraft: {
      note: "Bring hoops",
      reason: "Game",
      activity: "game" as const,
      scope: "one" as const,
    },
  };
  const review = step(
    spec,
    state,
    {
      _tag: "Action",
      action,
      confirmation: "Create?",
      preview: false,
      formKey: "selection-new",
    },
    props,
  ).state;
  expect(review.dialog).toBe("Confirm");
  expect(
    step(spec, review, { _tag: "Closed", dialog: "Selection" }, props).state,
  ).toEqual(review);
  const dismissed = step(spec, review, { _tag: "Dismiss" }, props).state;
  expect(dismissed.dialog).toBe("Selection");
  expect(dismissed.selectionDraft).toEqual(state.selectionDraft);
  expect(dismissed.selected).toEqual([1]);
});
it("ignores reads issued before a mutation and suppresses duplicate writes", () => {
  const started = step(
    spec,
    ready,
    {
      _tag: "Action",
      action,
      confirmation: "",
      preview: false,
      formKey: "season",
    },
    props,
  );
  expect(inputsFor(started.commands, saveDriver)).toHaveLength(1);
  expect(
    step(
      spec,
      started.state,
      {
        _tag: "Loaded",
        revision: 0,
        result: Either.right({ ...schedule, teams: [] }),
      },
      props,
    ).state,
  ).toEqual(started.state);
  expect(
    step(
      spec,
      started.state,
      { _tag: "LoadFailed", revision: 0, failure },
      props,
    ).state,
  ).toEqual(started.state);
  expect(
    step(spec, started.state, { _tag: "GuidanceFailed", failure }, props).state
      .operation,
  ).toBe("Saving");
  expect(
    inputsFor(
      step(spec, started.state, { _tag: "Confirm" }, props).commands,
      saveDriver,
    ),
  ).toEqual([]);
  expect(
    inputsFor(
      step(spec, started.state, { _tag: "Refresh" }, props).commands,
      scheduleDriver,
    ),
  ).toEqual([]);
});
it("reuses the mutation identity after a successful write followed by a failed reload", () => {
  const started = step(
    spec,
    ready,
    {
      _tag: "Action",
      action,
      confirmation: "",
      preview: false,
      formKey: "season",
    },
    props,
  ).state;
  const failed = step(
    spec,
    started,
    {
      _tag: "Saved",
      result: Either.right({
        key: "b".repeat(64),
        result: Either.left(failure),
      }),
    },
    props,
  ).state;
  expect(failed.operation).toBe("Idle");
  expect(failed.pending).toEqual(action);
  const retried = step(spec, failed, { _tag: "RetryAction" }, props);
  expect(inputsFor(retried.commands, saveDriver)[0]?.key).toBe("b".repeat(64));
});

it("arbitrary selection sequences retain unique, physically compatible slots", () => {
  FastCheck.assert(
    FastCheck.property(
      FastCheck.array(FastCheck.constantFrom(1, 2, 3), { maxLength: 80 }),
      (ids) => {
        const state = ids.reduce(
          (s, id) => step(spec, s, { _tag: "ToggleSlot", id }, props).state,
          ready,
        );
        expect(new Set(state.selected).size).toBe(state.selected.length);
        const slots = schedule.slots.filter((slot) =>
          state.selected.includes(slot.id),
        );
        expect(
          slots.every((slot, index) =>
            slots
              .slice(index + 1)
              .every((other) => !slotsConflict(slot, other)),
          ),
        ).toBe(true);
      },
    ),
    { seed: 20261010, numRuns: 100 },
  );
});
