import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import type { components } from "@gymtime/contracts";
import { capturedCode, origin } from "./setup.js";

test("multi-team coaches select weekly patterns and organizers make partial decisions in a focused queue", async ({
  page,
  browser,
  request,
}, info) => {
  let sequence = info.project.name === "chromium" ? 800 : 1000;
  const action = async (
    client: APIRequestContext,
    command: components["schemas"]["ActionBody"],
  ) => {
    const session = await (await client.get("/api/v1/auth/session")).json();
    const response = await client.post("/api/v1/schedule/actions", {
      data: command,
      headers: {
        Origin: origin,
        "X-CSRF-Token": session.csrf_token,
        "Idempotency-Key": (++sequence).toString(16).padStart(64, "0"),
      },
    });
    expect(response.status()).toBe(200);
  };
  const snapshot = async (): Promise<components["schemas"]["ScheduleView"]> =>
    await (await request.get("/api/v1/schedule")).json();
  const login = async (coach: Page, email: string) => {
    await coach.goto("/sign-in");
    await coach.getByLabel("Email address").fill(email);
    await coach.getByRole("button", { name: "Email me a code" }).click();
    await expect(coach.getByLabel("Sign-in code")).toBeVisible();
    await coach.getByLabel("Sign-in code").fill(await capturedCode(email));
    await coach.getByRole("button", { name: "Sign in", exact: true }).click();
    await coach.waitForURL("**/app");
    await expect(
      coach.getByRole("heading", { name: "My teams", exact: true }),
    ).toBeVisible();
  };
  const confirm = async (client: Page) => {
    await expect(
      client.getByRole("dialog", { name: "Confirm schedule change" }),
    ).toBeVisible();
    await client.getByRole("button", { name: "Confirm and save" }).click();
    await expect(
      client.getByRole("dialog", { name: "Confirm schedule change" }),
    ).not.toBeVisible();
  };
  const prefix = `${info.project.name}-patterns`;
  const email = `${prefix}@example.test`;
  const names = [
    `${prefix} 6th Grade Boys Basketball`,
    `${prefix} 7th Grade Boys Basketball`,
  ] as const;
  const dates =
    info.project.name === "chromium"
      ? (["2027-03-01", "2027-03-03", "2027-03-08", "2027-03-10"] as const)
      : (["2027-06-07", "2027-06-09", "2027-06-14", "2027-06-16"] as const);
  for (const name of names)
    await action(request, {
      operation: "create_team",
      name,
      primary: email,
      season: 1,
    });
  for (const [index, date] of dates.entries())
    await action(request, {
      operation: "create_slots",
      season: 1,
      start_date: date,
      end_date: date,
      weekdays: [index % 2 === 0 ? 0 : 2],
      start: index % 2 === 0 ? "16:00" : "17:00",
      end: index % 2 === 0 ? "17:00" : "18:00",
      space: index % 2 === 0 ? "full" : "half_a",
    });
  const initial = await snapshot();
  const team = initial.teams.find((team) => team.name === names[0]);
  const other = initial.teams.find((team) => team.name === names[1]);
  const blocked = initial.slots.find(
    (slot) => slot.date === dates[2] && slot.space === "full",
  );
  expect(team && other && blocked).toBeTruthy();
  if (!team || !other || !blocked) return;
  await action(request, {
    operation: "book_directly",
    team: other.id,
    slots: [blocked.id],
    activity: "game",
    note: "Only other team's calendar",
  });
  const context = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  const coach = await context.newPage();
  await login(coach, email);
  await expect(coach.getByLabel("View teams")).toHaveValue("-1");
  await coach.getByRole("button", { name: "Find time", exact: true }).click();
  await coach.getByLabel("From date").fill(dates[0]);
  await coach.getByLabel("Through date").fill(dates[1]);
  await coach
    .getByRole("button", { name: /Select .*16:00–17:00.*Full gym/ })
    .click();
  await coach
    .getByRole("button", { name: /Select .*17:00–18:00.*Half A/ })
    .click();
  await coach
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption(String(other.id));
  await expect(
    coach.getByText("2 times selected", { exact: true }),
  ).toHaveCount(2);
  await coach
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption(String(team.id));
  await coach.getByText("Repeat weekly", { exact: true }).click();
  await coach.getByLabel("Repeat through").fill(dates[3]);
  await coach
    .getByRole("button", { name: "Select matching weekly slots" })
    .click();
  await expect(
    coach.getByText("3 times selected", { exact: true }),
  ).toHaveCount(2);
  await coach
    .getByText("1 excluded date · Review exceptions", { exact: true })
    .click();
  await expect(
    coach
      .locator(".desktop-selection")
      .getByText(/This space and time are unavailable/),
  ).toBeVisible();
  // Mobile has a nearby review action, a native modal, and keyboard focus returns to its trigger.
  await coach.setViewportSize({ width: 390, height: 844 });
  await coach
    .getByRole("button", { name: "Review selection", exact: true })
    .focus();
  await coach.keyboard.press("Enter");
  const review = coach.getByRole("dialog", { name: "Review selected times" });
  await expect(review).toBeVisible();
  expect((await new AxeBuilder({ page: coach }).analyze()).violations).toEqual(
    [],
  );
  await coach.keyboard.press("Escape");
  await expect(
    coach.getByRole("button", { name: "Review selection", exact: true }),
  ).toBeFocused();
  await coach
    .getByRole("button", { name: "Review selection", exact: true })
    .click();
  await review.getByText("Add a note", { exact: true }).click();
  await review
    .getByLabel("Internal note (optional)")
    .fill("Private weekly pattern note");
  await coach.keyboard.press("Escape");
  await coach
    .getByRole("button", { name: "Review selection", exact: true })
    .click();
  await expect(review.getByLabel("Internal note (optional)")).toHaveValue(
    "Private weekly pattern note",
  );
  await review.getByRole("button", { name: "Submit selected dates" }).click();
  await coach.getByRole("button", { name: "Go back", exact: true }).click();
  await expect(review).toBeVisible();
  await expect(review.getByLabel("Internal note (optional)")).toHaveValue(
    "Private weekly pattern note",
  );
  await review.getByRole("button", { name: "Submit selected dates" }).click();
  await confirm(coach);
  await expect(
    coach.getByText(/Request sent · awaiting organizer approval/),
  ).toBeVisible();
  await page.goto("/app");
  await page.getByRole("button", { name: /^Requests/ }).click();
  await page.getByText("Filter requests", { exact: true }).click();
  await page.getByLabel("Team filter").selectOption(String(team.id));
  const group = page
    .locator("details.review-item")
    .filter({ hasText: "6th Boys" });
  await expect(group).toHaveCount(1);
  await group.locator("summary").first().click();
  const selected = group.getByRole("checkbox", { name: /Select request/ });
  await expect(selected).toHaveCount(3);
  await selected.nth(0).check();
  await selected.nth(1).check();
  await page
    .getByRole("button", { name: "Approve selected dates", exact: true })
    .click();
  await confirm(page);
  await expect(
    page.getByText("Request decisions saved.", { exact: true }),
  ).toBeVisible();
  await expect(group).toContainText("1 request");
  await group.locator("summary").first().click();
  await group
    .getByRole("button", { name: "Decline date", exact: true })
    .click();
  await confirm(page);
  await page
    .getByRole("button", { name: "Request history", exact: true })
    .click();
  await page.getByLabel("Search team, date or activity").fill(names[0]);
  await expect(
    page.getByText("Mixed decisions", { exact: true }),
  ).toBeVisible();
  await page
    .locator("details.review-item")
    .first()
    .locator("summary")
    .first()
    .click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(
    page.getByRole("article").filter({ hasText: "approved" }),
  ).toHaveCount(2);
  await expect(
    page.getByRole("article").filter({ hasText: "declined" }),
  ).toHaveCount(1);
  const final = await snapshot();
  expect(
    final.bookings.filter(
      (booking) => booking.team === team.id && booking.status === "confirmed",
    ),
  ).toHaveLength(2);
  expect(
    final.requests.filter(
      (request) => request.team === team.id && request.status === "declined",
    ),
  ).toHaveLength(1);
  await coach
    .getByRole("button", { name: "Parent links", exact: true })
    .click();
  const parentURL = await coach
    .getByRole("link", { name: `Open ${names[0]} parent calendar` })
    .getAttribute("href");
  const anonymous = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  const parent = await anonymous.newPage();
  await parent.goto(parentURL ?? "/");
  await expect(
    parent.getByRole("heading", { name: "Practice", exact: true }),
  ).toHaveCount(2);
  await expect(parent.locator("body")).not.toContainText(
    "Private weekly pattern note",
  );
  await expect(parent.locator("body")).not.toContainText(
    "Only other team's calendar",
  );
  expect((await new AxeBuilder({ page: parent }).analyze()).violations).toEqual(
    [],
  );
  await context.close();
  await anonymous.close();
});
