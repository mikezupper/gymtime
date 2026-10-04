import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { capturedCode, origin } from "./setup.js";

test("organizer invitations and coach email-code sign-in enforce permissions", async ({
  page,
  request,
}, info) => {
  const session = await (await request.get("/api/v1/auth/session")).json();
  const email = `${info.project.name}-coach@example.test`;
  const headers = {
    Origin: origin,
    "X-CSRF-Token": session.csrf_token,
    "Idempotency-Key": "f".repeat(64),
  };
  expect(
    (
      await request.post("/api/v1/accounts", {
        data: { email, role: "coach" },
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/v1/accounts", {
        data: { email, role: "coach" },
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/app");
  await expect(
    page.getByText("Organizer workspace", { exact: true }),
  ).toBeVisible();
  await page.getByText("Administration", { exact: true }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByRole("list")).toContainText(email);
  expect(
    (
      await request.patch(`/api/v1/accounts/${session.user_id}`, {
        data: { enabled: false },
        headers,
      })
    ).status(),
  ).toBe(409);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(page.getByLabel("Sign-in code")).toBeVisible();
  await page.getByLabel("Sign-in code").fill(await capturedCode(email));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Coach workspace", { exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/v1/accounts")).status()).toBe(403);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByText("Account · Coach", { exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Gymtime" }),
  ).toBeVisible();
  expect((await page.request.get("/api/v1/auth/session")).status()).toBe(401);
});
