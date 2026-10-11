import { settled, defineDriver } from "@gyral/core";
import {
  accountsDriver,
  scheduleDriver,
  saveDriver,
  guidanceDriver,
} from "../../apps/web/src/runtime/commands.js";
import { afterEach, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import { Either } from "effect";
import "../../apps/web/src/pages/gymtime-planner.js";
import "../../apps/web/src/components/gymtime-guide.js";
import { initialGuidance } from "../../apps/web/src/domain/guidance.js";
import { Session } from "../../apps/web/src/domain/api.js";
import type { Schedule } from "../../apps/web/src/domain/schedule.js";
import { BrowserGuidance } from "../../apps/web/src/infra/guidance-store.js";
import {
  readGuidance,
  writeGuidance,
} from "../../apps/web/src/services/guidance.js";
const schedule: Schedule = {
  gym: {
    name: "Your gym",
    timezone: "UTC",
    version: 1,
    split: false,
    hours: [],
  },
  seasons: [],
  teams: [],
  slots: [],
  bookings: [],
  requests: [],
  swaps: [],
  closures: [],
  now: 0,
};
const session = Schema.decodeUnknownSync(Session)({
  user_id: 50,
  email: "coach@example.test",
  organizer: false,
  csrf_token: "a".repeat(64),
});
it("the first saved season becomes the workspace selection without reloading", async () => {
  const saved: Schedule = {
    ...schedule,
    seasons: [
      {
        id: 7,
        name: "First season",
        start_date: "2027-01-01",
        end_date: "2027-02-01",
        status: "draft",
        version: 1,
      },
    ],
  };
  const planner = document.createElement("gymtime-planner");
  planner.session = { ...session, organizer: true };
  planner.drivers = {
    [scheduleDriver.name]: defineDriver({
      name: scheduleDriver.name,
      run: () => Either.right(schedule),
    }),
    [accountsDriver.name]: defineDriver({
      name: accountsDriver.name,
      run: () => Either.right([]),
    }),
    [guidanceDriver.name]: defineDriver({
      name: guidanceDriver.name,
      run: () => Either.right(initialGuidance),
    }),
    [saveDriver.name]: defineDriver({
      name: saveDriver.name,
      run: () =>
        Either.right({
          key: "a".repeat(64),
          result: Either.right({
            schedule: saved,
            outcome: { resources: [{ kind: "season", id: 7 }], warnings: [] },
          }),
        }),
    }),
  };
  document.body.append(planner);
  await settled();
  await expect
    .poll(() => planner.shadowRoot?.querySelector("select"))
    .toBeTruthy();
  planner.send({
    _tag: "Action",
    action: {
      operation: "create_season",
      name: "First season",
      start_date: "2027-01-01",
      end_date: "2027-02-01",
    },
    confirmation: "",
    preview: false,
    formKey: "create_season",
  });
  await expect
    .poll(
      () =>
        planner.shadowRoot?.querySelector<HTMLSelectElement>("select")?.value,
    )
    .toBe("7");
  const help = Array.from(
    planner.shadowRoot?.querySelectorAll("nav button") ?? [],
  ).find((button) => button.textContent?.trim() === "Help");
  if (help instanceof HTMLButtonElement) help.click();
  await settled();
  const guide = planner.shadowRoot?.querySelector("gymtime-guide");
  await settled();
  expect(guide?.shadowRoot?.textContent).toContain("First season");
  expect(guide?.shadowRoot?.textContent).toContain(
    "1 of 7 setup steps complete",
  );
  planner.remove();
});
afterEach(() => {
  document.body.replaceChildren();
  localStorage.removeItem("gymtime:guidance:v1:50");
  localStorage.removeItem("gymtime:guidance:v1:51");
});
it("fresh setup follows saved configuration and does not complete steps merely by opening them", async () => {
  const guide = document.createElement("gymtime-guide");
  guide.schedule = schedule;
  guide.session = { ...session, organizer: true };
  document.body.append(guide);
  await settled();
  expect(guide.shadowRoot?.textContent).toContain(
    "0 of 7 setup steps complete",
  );
  let destination = "";
  guide.addEventListener("gyral-output", (event) => {
    if (event instanceof CustomEvent && event.detail?._tag === "HelpGo")
      destination = event.detail.destination;
  });
  guide.shadowRoot
    ?.querySelector<HTMLButtonElement>(".guide-step button")
    ?.click();
  await settled();
  expect(destination).toBe("gym-setup");
  expect(guide.shadowRoot?.textContent).toContain(
    "0 of 7 setup steps complete",
  );
  guide.schedule = {
    ...schedule,
    gym: {
      ...schedule.gym,
      version: 2,
      hours: [{ weekday: 0, start: "16:00", end: "21:00" }],
    },
    seasons: [
      {
        id: 1,
        name: "Winter",
        start_date: "2027-01-01",
        end_date: "2027-02-01",
        status: "draft",
        version: 1,
      },
    ],
  };
  guide.season = 1;
  await settled();
  expect(guide.shadowRoot?.textContent).toContain(
    "2 of 7 setup steps complete",
  );
  guide.preferences = { ...initialGuidance, closures_reviewed: [1] };
  await settled();
  expect(guide.shadowRoot?.textContent).toContain(
    "3 of 7 setup steps complete",
  );
  guide.season = 2;
  await settled();
  expect(guide.shadowRoot?.textContent).toContain(
    "1 of 7 setup steps complete",
  );
});
it("assistant and mixed-role guides explain permissions per team without granting actions", async () => {
  const guide = document.createElement("gymtime-guide");
  guide.session = session;
  guide.season = 1;
  const team = {
    id: 1,
    name: "6th Girls",
    primary: 100,
    assistants: [50],
    seasons: [1],
    share_token: null,
    version: 1,
  };
  guide.schedule = { ...schedule, teams: [team] };
  document.body.append(guide);
  await settled();
  expect(guide.shadowRoot?.textContent).toContain(
    "Assistant coach: view schedules",
  );
  expect(guide.shadowRoot?.textContent).not.toContain(
    "Show me how to request time",
  );
  guide.schedule = {
    ...schedule,
    teams: [
      team,
      { ...team, id: 2, name: "7th Girls", primary: 50, assistants: [] },
    ],
  };
  await settled();
  expect(guide.shadowRoot?.textContent).toContain(
    "Primary coach: request and change time",
  );
  expect(guide.shadowRoot?.textContent?.replace(/\s+/g, " ")).toContain(
    "Your permissions follow the team you select",
  );
  expect(guide.shadowRoot?.textContent).toContain(
    "Show me how to request time",
  );
});
it("browser help preferences survive reloads, stay account-scoped, and report corrupt storage", async () => {
  const value = {
    intro_hidden: true,
    closures_reviewed: [1],
    shared_seasons: [1],
  };
  await Effect.runPromise(
    writeGuidance(50, value).pipe(Effect.provide(BrowserGuidance)),
  );
  expect(
    await Effect.runPromise(
      readGuidance(50).pipe(Effect.provide(BrowserGuidance)),
    ),
  ).toEqual(value);
  expect(
    await Effect.runPromise(
      readGuidance(51).pipe(Effect.provide(BrowserGuidance)),
    ),
  ).toEqual(initialGuidance);
  localStorage.setItem("gymtime:guidance:v1:50", '{"intro_hidden":"invalid"}');
  const result = await Effect.runPromise(
    readGuidance(50).pipe(Effect.provide(BrowserGuidance), Effect.either),
  );
  expect(result._tag).toBe("Left");
});

it("selects My teams when a coach's calendar options first mount", async () => {
  const planner = document.createElement("gymtime-planner");
  planner.session = session;
  planner.drivers = {
    [scheduleDriver.name]: defineDriver({
      name: scheduleDriver.name,
      run: () =>
        Either.right({
          ...schedule,
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
          teams: [
            {
              id: 1,
              name: "6th Girls",
              primary: 50,
              assistants: [],
              seasons: [1],
              share_token: null,
              version: 1,
            },
          ],
        }),
    }),
    [guidanceDriver.name]: defineDriver({
      name: guidanceDriver.name,
      run: () => Either.right(initialGuidance),
    }),
  };
  document.body.append(planner);
  await settled();
  const select = Array.from(
    planner.shadowRoot?.querySelectorAll("select") ?? [],
  ).find((x) => x.closest("label")?.textContent?.includes("View teams"));
  expect(select?.value).toBe("-1");
  if (select) {
    select.value = "0";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  await settled();
  expect(select?.value).toBe("0");
  planner.send({ _tag: "Refresh" });
  await settled();
  expect(select?.value).toBe("0");
});
