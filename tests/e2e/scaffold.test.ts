import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing content and navigation work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const response = await page.goto("http://127.0.0.1:3817/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Room for every team");
  await expect(page.getByRole("link", { name: "Preview Gymtime" })).toHaveAttribute("href", "/app");
  await context.close();
});

test("interactive shell reaches Rust and preserves search exclusions", async ({ page, request }) => {
  const response = await page.goto("/app");
  expect(response?.headers()["x-robots-tag"]).toBe("noindex");
  await page.getByText("Connection status",{exact:true}).click();
  await expect(page.locator("gymtime-connection").getByRole("status")).toContainText("service and database are connected");
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("button", { name: "Check connection again" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("gymtime-connection").getByRole("status")).toContainText("connected");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const parent = await request.get("/teams/example-token");
  expect(parent.headers()["x-robots-tag"]).toBe("noindex");
  expect(await parent.text()).not.toContain("organizer@example.test");
  expect((await request.get("/api/v1/missing")).status()).toBe(404);
  expect((await request.get("/missing-document")).status()).toBe(404);
  expect((await request.get("/assets/missing.js")).status()).toBe(404);
});

test("mobile and dark-mode shell remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to Gymtime");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
