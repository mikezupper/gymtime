import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { capturedCode, origin } from "./setup.js";
import type { components } from "@gymtime/contracts";
let sequence = 400;
async function action(
  client: APIRequestContext,
  command: components["schemas"]["ActionBody"],
) {
  const session = await (await client.get("/api/v1/auth/session")).json();
  const key = (++sequence).toString(16).padStart(64, "0");
  return client.post("/api/v1/schedule/actions", {
    data: command,
    headers: {
      Origin: origin,
      "X-CSRF-Token": session.csrf_token,
      "Idempotency-Key": key,
    },
  });
}
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel("Sign-in code").fill(await capturedCode(email));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app", { timeout: 10_000 });
  await expect(
    page.getByText("Coach workspace", { exact: true }),
  ).toBeVisible();
}
async function confirm(page: Page) {
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await expect(
    page
      .locator("gymtime-planner")
      .getByRole("status")
      .filter({
        hasText:
          /updated|saved|sent|cancelled|proposed|accepted|declined|assigned/,
      })
      .first(),
  ).toBeVisible();
}
test("competing requests, assistant permissions, reciprocal swap, closure preview, and inbox work", async ({
  page,
  browser,
  request,
}, info) => {
  // Numeric retry keys occupy a separate range for each browser, even when tests share the service.
  sequence = info.project.name === "chromium" ? 400 : 600;
  const prefix = `${info.project.name}-exchange`;
  const day = info.project.name === "chromium" ? "2027-04-05" : "2027-05-03";
  const names = [`${prefix} Team A`, `${prefix} Team B`] as const;
  const emails = [
    `${prefix}-a@example.test`,
    `${prefix}-b@example.test`,
  ] as const;
  for (let i = 0; i < 2; i++)
    expect(
      (
        await action(request, {
          operation: "create_team",
          name: names[i] ?? "",
          primary: emails[i] ?? "",
          season: 1,
        })
      ).status(),
    ).toBe(200);
  for (const space of ["full", "half_a", "half_b"] as const)
    expect(
      (
        await action(request, {
          operation: "create_slots",
          season: 1,
          start_date: day,
          end_date: day,
          weekdays: [0],
          start: "18:00",
          end: "19:00",
          space,
        })
      ).status(),
    ).toBe(200);
  let schedule: components["schemas"]["ScheduleView"] = await (
    await request.get("/api/v1/schedule")
  ).json();
  const a = schedule.teams.find((t) => t.name === names[0]);
  const b = schedule.teams.find((t) => t.name === names[1]);
  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  if (!a || !b) return;
  const getSlot = (space: string) =>
    schedule.slots.find((s) => s.date === day && s.space === space)?.id ?? 0;
  const contexts = await Promise.all([
    browser.newContext({
      baseURL: origin,
      storageState: { cookies: [], origins: [] },
    }),
    browser.newContext({
      baseURL: origin,
      storageState: { cookies: [], origins: [] },
    }),
    browser.newContext({
      baseURL: origin,
      storageState: { cookies: [], origins: [] },
    }),
  ]);
  const ca = contexts[0];
  const cb = contexts[1];
  const assistantContext = contexts[2];
  if (!ca || !cb || !assistantContext) return;
  const coachA = await ca.newPage();
  const coachB = await cb.newPage();
  await login(coachA, emails[0] ?? "");
  await login(coachB, emails[1] ?? "");
  expect(
    (
      await action(coachA.request, {
        operation: "submit_requests",
        team: a.id,
        slots: [getSlot("full")],
        activity: "practice",
        note: "secret A plan",
        reason: "",
      })
    ).status(),
  ).toBe(200);
  await coachB.reload();
  await coachB.getByRole("button", { name: "Find time", exact: true }).click();
  await coachB.getByLabel("From date").fill(day);
  await coachB.getByLabel("Through date").fill(day);
  await coachB
    .getByRole("button", { name: /Select .*18:00–19:00.*Half A/ })
    .click();
  await expect(coachB.getByLabel("Competing request reason")).toBeVisible();
  await coachB.getByRole("button", { name: "Submit selected dates" }).click();
  await expect(coachB.getByRole("dialog")).not.toBeVisible();
  expect(
    await coachB
      .getByLabel("Competing request reason")
      .evaluate((input: HTMLTextAreaElement) => input.validity.valueMissing),
  ).toBe(true);
  await coachB
    .getByLabel("Competing request reason")
    .fill("Preparation for the school game");
  await coachB.getByRole("button", { name: "Submit selected dates" }).click();
  await confirm(coachB);
  schedule = await (await request.get("/api/v1/schedule")).json();
  const pending = schedule.requests.find(
    (r) => r.team === b.id && r.status === "pending",
  );
  expect(pending).toBeTruthy();
  if (!pending) return;
  expect(
    (
      await action(request, {
        operation: "decide_requests",
        decisions: [
          { id: pending.id, approve: true, version: pending.version },
        ],
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await action(request, {
        operation: "book_directly",
        team: a.id,
        slots: [getSlot("half_b")],
        activity: "practice",
        note: "secret A plan",
      })
    ).status(),
  ).toBe(200);
  schedule = await (await request.get("/api/v1/schedule")).json();
  expect(schedule.requests.find((r) => r.team === a.id)?.status).toBe(
    "conflict_cancelled",
  );
  const first = schedule.bookings.find((b) => b.team === a.id);
  const second = schedule.bookings.find((v) => v.team === b.id);
  if (!first || !second) return;
  const assistantEmail = `${prefix}-assistant@example.test`;
  expect(
    (
      await action(request, {
        operation: "assign_assistant",
        team: b.id,
        email: assistantEmail,
        remove: false,
        version: b.version,
      })
    ).status(),
  ).toBe(200);
  const assistant = await assistantContext.newPage();
  await login(assistant, assistantEmail);
  expect(
    (
      await action(assistant.request, {
        operation: "cancel_booking",
        id: second.id,
        scope: "one",
        version: second.version,
      })
    ).status(),
  ).toBe(403);
  await coachA.reload();
  await coachA.getByLabel("Week containing").fill(day);
  await coachA
    .locator("gymtime-calendar")
    .getByRole("button", { name: new RegExp(`${names[0]}.*Confirmed`) })
    .click();
  const card = coachA
    .getByRole("dialog", { name: "Booking details" })
    .getByRole("article");
  await expect(coachA.locator('select[name="second"]')).toHaveCount(0);
  await card.getByText("Propose a swap", { exact: true }).click();
  await card
    .getByLabel("Swap with confirmed booking")
    .selectOption(String(second.id));
  await card.getByRole("button", { name: "Send swap proposal" }).click();
  await expect(coachA.getByRole("dialog")).toContainText(names[0] ?? "");
  await expect(coachA.getByRole("dialog")).toContainText(names[1] ?? "");
  await confirm(coachA);
  schedule = await (await request.get("/api/v1/schedule")).json();
  const proposal = schedule.swaps.find((swap) => swap.first === first.id);
  if (!proposal) return;
  expect(
    (
      await action(assistant.request, {
        operation: "respond_swap",
        id: proposal.id,
        accept: true,
        version: proposal.version,
      })
    ).status(),
  ).toBe(403);
  await coachB.reload();
  await coachB.getByRole("button", { name: "Swaps", exact: true }).click();
  await coachB
    .getByRole("button", { name: "Accept swap", exact: true })
    .click();
  await confirm(coachB);
  schedule = await (await request.get("/api/v1/schedule")).json();
  expect(schedule.bookings.find((b) => b.id === first.id)?.slot).toBe(
    second.slot,
  );
  expect(schedule.bookings.find((b) => b.id === second.id)?.slot).toBe(
    first.slot,
  );
  await page.goto("/app");
  await page.getByText("Administration", { exact: true }).click();
  await page.getByRole("button", { name: "Gym setup", exact: true }).click();
  const closure = page.getByRole("region", {
    name: "Gym unavailable",
    exact: true,
  });
  await closure.getByLabel("Closure starts on").fill(day);
  await closure.getByLabel("Closure ends on").fill(day);
  await closure.getByLabel("Starts at", { exact: true }).fill("18:00");
  await closure.getByLabel("Ends at", { exact: true }).fill("19:00");
  await closure.getByLabel("Reason").fill("School assembly");
  await closure.getByRole("button", { name: "Preview closure" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "2 confirmed booking(s)",
  );
  await expect(page.getByRole("dialog")).toContainText(names[0] ?? "");
  await expect(page.getByRole("dialog")).toContainText(names[1] ?? "");
  await confirm(page);
  schedule = await (await request.get("/api/v1/schedule")).json();
  expect(
    schedule.slots.filter((s) => s.date === day).every((s) => !s.available),
  ).toBe(true);
  expect(
    schedule.bookings
      .filter((b) => b.id === first.id || b.id === second.id)
      .every((b) => b.status === "closure_cancelled"),
  ).toBe(true);
  await assistant.reload();
  await assistant
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    assistant.getByRole("heading", {
      name: "Gym time unavailable",
      exact: true,
    }),
  ).toBeVisible();
  await expect(assistant.getByRole("list")).toContainText("School assembly");
  expect(
    (await new AxeBuilder({ page: assistant }).analyze()).violations,
  ).toEqual([]);
  await Promise.all(contexts.map((context) => context.close()));
});
