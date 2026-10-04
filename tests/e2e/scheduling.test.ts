import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  request as apiRequest,
  type Page,
} from "@playwright/test";
import { capturedCode, origin } from "./setup.js";
async function signIn(page: Page, email: string) {
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
  await expect(page.getByRole("dialog")).not.toBeVisible();
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
test("organizer setup, coach request, approval, parent subscription, and cancellation work together", async ({
  page,
  browser,
  request,
}, info) => {
  const prefix = info.project.name;
  const email = `${prefix}-primary@example.test`;
  const teamName = `${prefix} 4th Grade`;
  const first = prefix === "chromium" ? "2027-01-04" : "2027-02-01";
  const last = prefix === "chromium" ? "2027-01-11" : "2027-02-08";
  await page.goto("/app");
  await page.getByText("Administration", { exact: true }).click();
  await page.getByRole("button", { name: "Gym setup", exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const teamSection = page.getByRole("region", {
    name: "Teams and coaches",
    exact: true,
  });
  await teamSection
    .getByLabel("Team name", { exact: true })
    .first()
    .fill(teamName);
  await teamSection.getByLabel("Primary coach email").first().fill(email);
  await teamSection
    .getByRole("button", { name: "Create team and invite coach" })
    .click();
  await expect(
    teamSection.getByRole("heading", { name: teamName }),
  ).toBeVisible();
  const slots = page.getByRole("region", {
    name: "Define bookable slots",
    exact: true,
  });
  await slots.getByLabel("First date").fill(first);
  await slots.getByLabel("Last date").fill(last);
  await slots.getByLabel("Slot starts").fill("16:00");
  await slots.getByLabel("Slot ends").fill("17:00");
  await slots.getByLabel("Gym space").selectOption("half_a");
  await slots.getByLabel("Mon", { exact: true }).check();
  await slots.getByRole("button", { name: "Preview slots" }).click();
  await expect(page.getByRole("dialog")).toContainText(first);
  await expect(page.getByRole("dialog")).toContainText(last);
  await confirm(page);
  const context = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  const coach = await context.newPage();
  await signIn(coach, email);
  await coach.getByRole("button", { name: "Find time", exact: true }).click();
  await coach.getByLabel("From date").fill(first);
  await coach.getByLabel("Through date").fill(first);
  await coach
    .getByRole("button", { name: /Select .*16:00–17:00.*Half A/ })
    .click();
  await coach.getByText("Add a note", { exact: true }).click();
  await coach
    .getByLabel("Internal note (optional)")
    .fill("private game strategy");
  await coach.getByRole("button", { name: "Submit selected dates" }).click();
  await confirm(coach);
  await page.getByRole("button", { name: /Requests \(/ }).click();
  await page.getByRole("button", { name: "Refresh schedule" }).count();
  // The organizer refreshes to see requests submitted from another account.
  await page.reload();
  await page.getByRole("button", { name: /Requests \(/ }).click();
  await page
    .locator("details.review-item")
    .filter({ hasText: teamName })
    .locator("summary")
    .first()
    .click();
  const pending = page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: teamName, exact: true }),
    });
  await expect(pending).toContainText("pending");
  await pending.getByRole("button", { name: "Approve date" }).click();
  await confirm(page);
  // Closed booking editors do not build season-sized selects; opening preserves a draft across collapse and refresh.
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await page.getByLabel("Week containing").fill(first);
  await page
    .locator("gymtime-calendar")
    .getByRole("button", { name: new RegExp(`${teamName}.*Confirmed`) })
    .click();
  const organizerBooking = page
    .getByRole("dialog", { name: "Booking details" })
    .getByRole("article");
  await expect(page.locator('select[name="slot"]')).toHaveCount(0);
  const editor = organizerBooking.getByText(
    "Organizer: change booking directly",
    { exact: true },
  );
  await editor.click();
  const replacement = organizerBooking.getByLabel("Replacement slot");
  await expect(replacement).toBeVisible();
  const schedule = await (await request.get("/api/v1/schedule")).json();
  const later = schedule.slots.find(
    (slot: { date: string; space: string }) =>
      slot.date === last && slot.space === "half_a",
  );
  expect(later).toBeTruthy();
  await organizerBooking.getByLabel("Replacement date").fill(last);
  await replacement.selectOption(String(later.id));
  await editor.click();
  await expect(replacement).not.toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh schedule", exact: true })
    .click();
  await page
    .locator("gymtime-calendar")
    .getByRole("button", { name: new RegExp(`${teamName}.*Confirmed`) })
    .click();
  await editor.click();
  await expect(replacement).toHaveValue(String(later.id));
  await coach.reload();
  await coach
    .getByRole("button", { name: "Parent links", exact: true })
    .click();
  const link = coach.getByRole("link", {
    name: `Open ${teamName} parent calendar`,
  });
  const url = await link.getAttribute("href");
  expect(url).toBeTruthy();
  const parentContext = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  const parent = await parentContext.newPage();
  await parent.goto(url ?? "/");
  await expect(
    parent.getByRole("heading", { name: teamName, exact: true }),
  ).toBeVisible();
  await expect(
    parent.getByRole("heading", { name: "Practice", exact: true }),
  ).toBeVisible();
  await expect(parent.locator("body")).not.toContainText(
    "private game strategy",
  );
  expect((await new AxeBuilder({ page: parent }).analyze()).violations).toEqual(
    [],
  );
  const calendarURL = await parent
    .getByRole("link", { name: "Download calendar file" })
    .getAttribute("href");
  const client = await apiRequest.newContext();
  const feed = await client.get(calendarURL ?? "");
  expect(feed.headers()["content-type"]).toContain("text/calendar");
  expect(feed.headers()["x-robots-tag"]).toBe("noindex");
  const text = await feed.text();
  expect(text).toContain("BEGIN:VEVENT");
  expect(text).not.toContain("private game strategy");
  const uid = text.match(/UID:([^\r]+)/)?.[1];
  expect(uid).toBeTruthy();
  await coach.getByRole("button", { name: "Calendar", exact: true }).click();
  await coach.getByLabel("Week containing").fill(first);
  await coach
    .locator("gymtime-calendar")
    .getByRole("button", { name: new RegExp(`${teamName}.*Confirmed`) })
    .click();
  const booking = coach
    .getByRole("dialog", { name: "Booking details" })
    .getByRole("article");
  await booking.getByText("Cancel booking", { exact: true }).click();
  await booking.getByRole("button", { name: "Cancel selected dates" }).click();
  await confirm(coach);
  await coach.getByRole("button", { name: "History", exact: true }).click();
  await coach.getByLabel("Search team, date or activity").fill(teamName);
  await expect(coach.locator(".history-list")).toContainText("coach cancelled");
  await parent.getByRole("button", { name: "Refresh team schedule" }).click();
  await expect(
    parent.getByRole("heading", { name: "Practice", exact: true }),
  ).not.toBeVisible();
  const cancelled = await (await client.get(calendarURL ?? "")).text();
  expect(cancelled).toContain(`UID:${uid}`);
  expect(cancelled).toContain("SEQUENCE:1");
  expect(cancelled).toContain("STATUS:CANCELLED");
  expect((await request.get("/api/v1/audit")).status()).toBe(200);
  await coach.setViewportSize({ width: 390, height: 844 });
  expect(
    await coach.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page: coach }).analyze()).violations).toEqual(
    [],
  );
  await client.dispose();
  await parentContext.close();
  await context.close();
});
