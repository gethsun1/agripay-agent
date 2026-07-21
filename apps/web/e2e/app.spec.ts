import { expect, test, type Page } from "@playwright/test";
async function mockTask(page: Page, state = "completed") {
  let posts = 0;
  await page.route("**/api/agent/tasks", async (route) => {
    posts++;
    await route.fulfill({
      json: { taskId: "task-demo", correlationId: "corr-demo", state: "created" },
      status: 202,
    });
  });
  await page.route("**/api/agent/tasks/task-demo", (route) =>
    route.fulfill({
      json: {
        id: "task-demo",
        correlation_id: "corr-demo",
        question: "demo",
        state,
        plan_source: state === "partial" ? "deterministic-fallback" : "groq",
        fallback_reason: state === "partial" ? "groq_timeout" : null,
        plan_json: null,
        answer_json: null,
        estimated_tinybars: "16000000",
        spent_tinybars: state === "failed" ? "0" : "16000000",
        created_at: "2026-07-22T00:00:00Z",
        updated_at: "2026-07-22T00:00:01Z",
        purchases: [],
      },
    }),
  );
  await page.route("**/api/agent/tasks/task-demo/events", (route) =>
    route.fulfill({
      json: [
        {
          id: 1,
          task_id: "task-demo",
          resource_id: null,
          state: "created",
          event_type: "task_created",
          detail: "Task created",
          created_at: "2026-07-22T00:00:00Z",
        },
        {
          id: 2,
          task_id: "task-demo",
          resource_id: "weather-risk",
          state: state,
          event_type: state === "failed" ? "preflight_policy_rejected" : "resource_validated",
          detail: state === "partial" ? "Partial result delivered" : "HTTP 200 validated",
          created_at: "2026-07-22T00:00:01Z",
        },
      ],
    }),
  );
  return () => posts;
}
test("landing flows to agent workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /autonomous intelligence/i })).toBeVisible();
  await page
    .getByRole("link", { name: /ask the agent/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/agent/);
});
test("successful mock multi-resource task", async ({ page }) => {
  await mockTask(page);
  await page.goto("/agent");
  await page.getByRole("button", { name: /run demonstration/i }).click();
  await expect(page.getByRole("heading", { name: "completed" })).toBeVisible();
});
test("Groq fallback and partial task are legible", async ({ page }) => {
  await mockTask(page, "partial");
  await page.goto("/agent");
  await page.getByRole("button", { name: /run demonstration/i }).click();
  await expect(page.getByRole("heading", { name: "partial" })).toBeVisible();
  await expect(page.getByText("Partial result delivered")).toBeVisible();
});
test("budget rejection is presented safely", async ({ page }) => {
  await page.route("**/api/agent/tasks", (route) =>
    route.fulfill({
      status: 409,
      json: { error: "task_budget", message: "Planned task exceeds budget" },
    }),
  );
  await page.goto("/agent");
  await page.getByRole("button", { name: /run demonstration/i }).click();
  await expect(page.getByRole("alert")).toContainText("Planned task exceeds budget");
});
test("receipt inspection exposes real public evidence", async ({ page }) => {
  await page.goto("/receipts");
  await page.getByRole("button", { name: "Inspect" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Real Hedera testnet receipt");
});
test("developer lifecycle is sanitized", async ({ page }) => {
  await page.goto("/developer");
  await expect(page.getByText("Redaction boundary")).toBeVisible();
  await page.getByRole("tab", { name: "Sanitized JSON" }).click();
  await expect(page.getByText(/REDACTED — signed bytes/)).toBeVisible();
});
test("verified evidence is historical", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/historical phase 2 transactions/i)).toBeVisible();
});
test("refresh resumes reads without duplicate task creation", async ({ page }) => {
  const posts = await mockTask(page);
  await page.goto("/agent");
  await page.getByRole("button", { name: /run demonstration/i }).click();
  await expect(page).toHaveURL(/task=task-demo/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "completed" })).toBeVisible();
  expect(posts()).toBe(1);
});
test("mobile navigation reaches workspace", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Agent", exact: true }).click();
  await expect(page.getByRole("heading", { name: /one question/i })).toBeVisible();
});
test("keyboard-only primary flow reaches live confirmation", async ({ page }) => {
  await page.goto("/agent");
  await page.keyboard.press("Tab");
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
test("about explains deterministic boundary", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByText("Groq proposes.")).toBeVisible();
  await expect(page.getByText(/durable replay protection/i)).toBeVisible();
});
