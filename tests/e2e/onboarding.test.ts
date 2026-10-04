import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { components } from "@gymtime/contracts";
import { capturedCode, origin } from "./setup.js";

test("organizers resume setup and coaches and parents receive accessible role guides", async ({
  page,
  request,
  browser,
}, info) => {
  let sequence = info.project.name === "chromium" ? 2200 : 2400;
  const prefix = `${info.project.name}-guidance`;
  const email = `${prefix}@example.test`;
  const action = async (command: components["schemas"]["ActionBody"]) => {
    const session = await (await request.get("/api/v1/auth/session")).json();
    const response = await request.post("/api/v1/schedule/actions", {
      data: command,
      headers: {
        Origin: origin,
        "X-CSRF-Token": session.csrf_token,
        "Idempotency-Key": (++sequence).toString(16).padStart(64, "0"),
      },
    });
    expect(response.status()).toBe(200);
    return await response.json();
  };
  const login = async (target: Page) => {
    await target.goto("/sign-in");
    await target.getByLabel("Email address").fill(email);
    await target.getByRole("button", { name: "Email me a code" }).click();
    await expect(target.getByLabel("Sign-in code")).toBeVisible();
    await target.getByLabel("Sign-in code").fill(await capturedCode(email));
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await target.waitForURL("**/app");
  };
  const seasonName = `${prefix} next season`;
  const created = await action({
    operation: "create_season",
    name: seasonName,
    start_date: "2028-10-01",
    end_date: "2029-02-01",
  });
  const season = created.resources[0].id;
  await page.goto("/app");
  await page.getByLabel("Season", { exact: true }).selectOption(String(season));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Set up your season", exact: true }),
  ).toBeVisible();
  const guide = page.locator("gymtime-guide");
  await guide
    .getByRole("button", { name: "No closures to add", exact: true })
    .click();
  await page.reload();
  await page.getByLabel("Season", { exact: true }).selectOption(String(season));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(
    guide.locator(".guide-step").filter({ hasText: "Review unavailable time" }),
  ).toContainText("Complete");
  await guide
    .getByRole("button", { name: "Start: Add teams and coaches", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Teams and coaches", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Team season")).toHaveValue(String(season));
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await guide.getByText("Review saved setup", { exact: true }).click();
  await expect(guide.getByText("Season:", { exact: true }).locator("..")).toContainText(seasonName);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  const help = page.getByRole("button", {
    name: "Help: Reading the calendar",
    exact: true,
  });
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("Full gym uses both halves", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await expect(help).toBeFocused();
  await action({
    operation: "create_team",
    name: `${prefix} primary`,
    primary: email,
    season: 1,
  });
  await action({
    operation: "create_team",
    name: `${prefix} assistant`,
    primary: `${prefix}-other@example.test`,
    season: 1,
  });
  const snapshot: components["schemas"]["ScheduleView"] = await (
    await request.get("/api/v1/schedule")
  ).json();
  const team = snapshot.teams.find((team) => team.name === `${prefix} primary`);
  const other = snapshot.teams.find(
    (team) => team.name === `${prefix} assistant`,
  );
  expect(team && other).toBeTruthy();
  if (!team || !other) return;
  await action({
    operation: "assign_assistant",
    team: other.id,
    email,
    remove: false,
    version: other.version,
  });
  await action({
    operation: "create_slots",
    season: 1,
    start_date: "2027-10-22",
    end_date: "2027-10-22",
    weekdays: [4],
    start: "20:00",
    end: "21:00",
    space: "half_a",
  });
  const context = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  const coach = await context.newPage();
  await login(coach);
  await coach
    .getByRole("button", { name: "Open coach guide", exact: true })
    .click();
  await expect(coach.locator("gymtime-guide")).toContainText(
    "Primary coach: request and change time",
  );
  await expect(coach.locator("gymtime-guide")).toContainText(
    "Assistant coach: view schedules",
  );
  await coach
    .getByRole("button", { name: "Show me how to request time", exact: true })
    .click();
  await expect(
    coach.getByRole("heading", { name: "Request time · Step 1 of 3" }),
  ).toBeVisible();
  await coach.getByRole("button", { name: "Next tip" }).click();
  await coach.getByRole("button", { name: "Next tip" }).click();
  await expect(
    coach.getByText("This walkthrough does not send anything for you", {
      exact: false,
    }),
  ).toBeVisible();
  await coach.getByRole("button", { name: "Finish walkthrough" }).click();
  const after: components["schemas"]["ScheduleView"] = await (
    await request.get("/api/v1/schedule")
  ).json();
  expect(
    after.requests.filter(
      (value) => value.team === team.id || value.team === other.id,
    ),
  ).toHaveLength(0);
  await coach.getByRole("button", { name: "Dismiss getting started" }).click();
  await coach.reload();
  await expect(
    coach.getByRole("button", { name: "Open coach guide", exact: true }),
  ).toHaveCount(0);
  await coach.getByRole("button", { name: "Help", exact: true }).click();
  await expect(
    coach.getByRole("heading", { name: "Getting started with your team" }),
  ).toBeVisible();
  await coach.setViewportSize({ width: 390, height: 844 });
  expect((await new AxeBuilder({ page: coach }).analyze()).violations).toEqual(
    [],
  );
  expect(
    await coach.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const parent = await context.newPage();
  await parent.goto(`/teams/${team.share_token}`);
  await parent.getByText("New to this team calendar?", { exact: true }).click();
  await expect(
    parent.getByText("No account is needed", { exact: false }),
  ).toBeVisible();
  await parent.getByText("Google Calendar", { exact: true }).click();
  await expect(
    parent.getByText("On a computer, open Google Calendar", { exact: false }),
  ).toBeVisible();
  await expect(parent.getByLabel("Calendar subscription URL")).toHaveValue(
    /\/calendars\/.*\.ics$/,
  );
  expect((await new AxeBuilder({ page: parent }).analyze()).violations).toEqual(
    [],
  );
  await parent.emulateMedia({ colorScheme: "dark" });
  expect((await new AxeBuilder({ page: parent }).analyze()).violations).toEqual(
    [],
  );
  await context.close();
});
