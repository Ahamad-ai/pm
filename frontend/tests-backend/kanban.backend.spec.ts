import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

test("loads backend-served static kanban board", async ({ page }) => {
  await signIn(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("persists board changes after page reload", async ({ page }) => {
  await signIn(page);

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persistent card");
  await firstColumn.getByPlaceholder("Details").fill("Stored via backend.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Persistent card")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Persistent card")).toBeVisible();
});

test("applies AI chat board updates in UI", async ({ page }) => {
  await signIn(page);

  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        assistant_message: "Done. I added an AI card.",
        board_updated: true,
        board: {
          columns: [
            { id: "col-backlog", title: "Backlog", cardIds: ["card-ai"] },
            { id: "col-discovery", title: "Discovery", cardIds: [] },
            { id: "col-progress", title: "In Progress", cardIds: [] },
            { id: "col-review", title: "Review", cardIds: [] },
            { id: "col-done", title: "Done", cardIds: [] },
          ],
          cards: {
            "card-ai": {
              id: "card-ai",
              title: "AI generated card",
              details: "Created from chat",
            },
          },
        },
      }),
    });
  });

  await page.getByLabel("Chat message").fill("Add a card from AI");
  await page.getByRole("button", { name: /send/i }).click();

  await expect(page.getByText("Done. I added an AI card.")).toBeVisible();
  await expect(page.getByText("AI generated card")).toBeVisible();
});
