/**
 * Template & Category E2E Flows (Flows 2–6)
 *
 * Covers:
 *  - Flow 2: Create new template via modal (category selector)
 *  - Flow 3: Edit existing template, change category
 *  - Flow 4: Navigate to Settings → Template Categories tab
 *  - Flow 5: Create a new category
 *  - Flow 6: Delete category — verify confirmation dialog
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = "http://localhost:3001/outreach";
const TEMPLATES_URL = `${BASE_URL}/templates`;
const SETTINGS_URL = `${BASE_URL}/settings`;

const EVIDENCE_DIR = path.resolve(
  __dirname,
  "../.sisyphus/evidence/template-flows",
);

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function screenshot(page: Page, name: string): Promise<void> {
  const filePath = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[EVIDENCE] Screenshot: ${name}.png`);
}

// ---------------------------------------------------------------------------
// Auth mock setup — mirrors the established pattern in coordinator-toggle.spec.ts
// ---------------------------------------------------------------------------
async function setupAuthMocks(context: BrowserContext): Promise<void> {
  const saxId = 42;
  const saxRoleId = 999;

  await context.route("**/auth/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sub: "test-sax-user-42",
        email: "test@example.com",
        name: "Test SAX User",
        sax_id: saxId,
        tenant_id: "tenant-001",
        practice_id: "practice-001",
        practice_name: "Test Practice",
      }),
    });
  });

  await context.route("**/api/auth/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        sax_id: saxId,
        tenant_id: "tenant-001",
        practice_id: "practice-001",
      }),
    });
  });

  await context.route("**/api/auth/set-cookie**", async (route) => {
    await route.fulfill({ status: 200, body: "ok" });
  });

  await context.route("**/api/track-login**", async (route) => {
    await route.fulfill({ status: 200, body: "ok" });
  });

  await context.route("**/api/outreach/user/roles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        roles: [{ role_id: saxRoleId, active: true, name: "Sax" }],
      }),
    });
  });

  await context.route("**/api/outreach/roles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        roles: [{ role_id: saxRoleId, name: "Sax", active: true }],
      }),
    });
  });

  // Inject SAX role into localStorage so AuthGuard passes immediately
  await context.addInitScript(
    ({ roleId, sid }: { roleId: number; sid: number }) => {
      const userRoles = [{ role_id: roleId, active: true, name: "Sax" }];
      const allRoles = [{ role_id: roleId, name: "Sax", active: true }];
      localStorage.setItem("user_roles", JSON.stringify(userRoles));
      localStorage.setItem("all_roles", JSON.stringify(allRoles));

      // Also inject sax_user_id so hooks that key off user id resolve correctly
      localStorage.setItem("sax_user_id", String(sid));
    },
    { roleId: saxRoleId, sid: saxId },
  );
}

// ---------------------------------------------------------------------------
// Shared template API mocks
// ---------------------------------------------------------------------------
const MOCK_TEMPLATE = {
  id: "tpl-001",
  name: "Appointment Reminder",
  category: "reminder",
  content: "Hi {{patientFirstName}}, your appointment is tomorrow.",
  variables: ["patientFirstName"],
  isGlobal: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_CATEGORY = {
  id: "cat-001",
  name: "Follow Up",
  createdAt: new Date().toISOString(),
};

async function setupTemplateMocks(
  context: BrowserContext,
  options: {
    templates?: (typeof MOCK_TEMPLATE)[];
    categories?: (typeof MOCK_CATEGORY)[];
    captureCreateTemplate?: (body: Record<string, unknown>) => void;
    captureCreateCategory?: (body: Record<string, unknown>) => void;
  } = {},
): Promise<void> {
  const templates = options.templates ?? [MOCK_TEMPLATE];
  const categories = options.categories ?? [MOCK_CATEGORY];

  // GET /api/outreach/templates
  await context.route("**/api/outreach/templates", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: templates,
          pagination: { total: templates.length },
        }),
      });
      return;
    }
    // POST (create template)
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() ?? {};
      options.captureCreateTemplate?.(body);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_TEMPLATE,
          id: "tpl-new-001",
          name: body.name ?? "New Template",
          category: body.category ?? "general",
          content: body.body ?? "",
        }),
      });
      return;
    }
    await route.continue();
  });

  // PATCH /api/outreach/templates/:id
  await context.route("**/api/outreach/templates/**", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() ?? {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_TEMPLATE, ...body }),
      });
      return;
    }
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  // GET /api/outreach/template-categories
  await context.route("**/api/outreach/template-categories", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: categories,
          pagination: { total: categories.length },
        }),
      });
      return;
    }
    // POST (create category)
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() ?? {};
      options.captureCreateCategory?.(body);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "cat-new-001",
          name: body.name ?? "New Category",
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.continue();
  });

  // DELETE /api/outreach/template-categories/:id
  await context.route(
    "**/api/outreach/template-categories/**",
    async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.continue();
    },
  );
}

// ===========================================================================
// FLOW 2 — Create new template with category selector
// ===========================================================================
test("Flow 2: Create new template with category selector", async ({
  context,
  page,
}) => {
  await setupAuthMocks(context);

  let capturedBody: Record<string, unknown> = {};
  await setupTemplateMocks(context, {
    templates: [], // empty list so page shows create prompt
    captureCreateTemplate: (body) => {
      capturedBody = body;
    },
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await test.step("Navigate to templates page", async () => {
    await page.goto(TEMPLATES_URL, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /message templates/i }),
    ).toBeVisible({ timeout: 15000 });
    await screenshot(page, "f2-01-templates-page-loaded");
  });

  await test.step("Click New Template button", async () => {
    // Desktop button is inside TemplateList's onCreate button
    const newTemplateBtn = page
      .getByRole("button", { name: /new template/i })
      .first();
    await expect(newTemplateBtn).toBeVisible({ timeout: 10000 });
    await newTemplateBtn.click();
    await screenshot(page, "f2-02-new-template-button-clicked");
  });

  await test.step("Template modal opens with form", async () => {
    await expect(
      page.getByRole("dialog").getByText(/create template/i),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Template Name")).toBeVisible();
    await expect(page.locator("#category")).toBeVisible();
    await expect(page.locator("#content")).toBeVisible();
    await screenshot(page, "f2-03-modal-open");
  });

  await test.step("Category dropdown has expected options", async () => {
    const categorySelect = page.locator("#category");
    const options = await categorySelect.locator("option").allTextContents();
    console.log("[F2] Category options:", options);
    // Static categories from TemplateEditor
    expect(options).toContain("Welcome");
    expect(options).toContain("Reminder");
    expect(options).toContain("Follow-up");
    expect(options).toContain("Education");
    expect(options).toContain("General");
    await screenshot(page, "f2-04-category-options");
  });

  await test.step("Fill in template form and select a category", async () => {
    await page.getByLabel("Template Name").fill("Test Appointment Reminder");
    await page.locator("#category").selectOption("reminder");
    await page
      .locator("#content")
      .fill("Hi {{patientFirstName}}, your appointment is tomorrow at 9am.");
    await screenshot(page, "f2-05-form-filled");
  });

  await test.step("Variable detection badge appears", async () => {
    // Content has {{patientFirstName}} so badge should appear
    await expect(page.getByText("patientFirstName")).toBeVisible({
      timeout: 3000,
    });
    await screenshot(page, "f2-06-variable-badge-detected");
  });

  await test.step("Submit form — Create Template button", async () => {
    await page.getByRole("button", { name: /create template/i }).click();
    // Modal should close after successful save
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
    await screenshot(page, "f2-07-after-submit");
  });

  await test.step("Verify API call payload", async () => {
    console.log("[F2] Captured POST body:", JSON.stringify(capturedBody));
    expect(capturedBody).toMatchObject({
      name: "Test Appointment Reminder",
      category: "reminder",
    });
    expect(capturedBody).toHaveProperty("body"); // API expects 'body' not 'content'
  });

  await test.step("Check for console errors", async () => {
    const relevant = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("localhost:3000") &&
        !e.includes("net::ERR"),
    );
    console.log("[F2] Console errors:", relevant);
    expect(relevant, "No unexpected console errors in Flow 2").toHaveLength(0);
  });
});

// ===========================================================================
// FLOW 3 — Edit existing template, change category
// ===========================================================================
test("Flow 3: Edit existing template and change category", async ({
  context,
  page,
}) => {
  await setupAuthMocks(context);
  await setupTemplateMocks(context, { templates: [MOCK_TEMPLATE] });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await test.step("Navigate to templates page with existing template", async () => {
    await page.goto(TEMPLATES_URL, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /message templates/i }),
    ).toBeVisible({ timeout: 15000 });
    // Wait for template list to render the mock template
    await expect(page.getByText("Appointment Reminder")).toBeVisible({
      timeout: 8000,
    });
    await screenshot(page, "f3-01-templates-with-existing");
  });

  await test.step("Click edit button on existing template", async () => {
    // Edit button is typically an icon button next to the template name
    // Try aria-label 'Edit' or button within the template row
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();
    await screenshot(page, "f3-02-edit-button-clicked");
  });

  await test.step("Edit modal opens with template data pre-filled", async () => {
    await expect(
      page.getByRole("dialog").getByText(/edit template/i),
    ).toBeVisible({ timeout: 5000 });
    // Name should be pre-filled
    await expect(page.getByLabel("Template Name")).toHaveValue(
      "Appointment Reminder",
    );
    // Category should be pre-selected as 'reminder'
    await expect(page.locator("#category")).toHaveValue("reminder");
    await screenshot(page, "f3-03-edit-modal-prefilled");
  });

  await test.step("Change category to 'follow-up'", async () => {
    await page.locator("#category").selectOption("follow-up");
    await expect(page.locator("#category")).toHaveValue("follow-up");
    await screenshot(page, "f3-04-category-changed");
  });

  await test.step("Save changes", async () => {
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
    await screenshot(page, "f3-05-after-save");
  });

  await test.step("Check for console errors", async () => {
    const relevant = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("localhost:3000") &&
        !e.includes("net::ERR"),
    );
    console.log("[F3] Console errors:", relevant);
    expect(relevant, "No unexpected console errors in Flow 3").toHaveLength(0);
  });
});

// ===========================================================================
// FLOW 4 — Navigate to Settings → Template Categories tab
// ===========================================================================
test("Flow 4: Navigate to Settings → Template Categories tab", async ({
  context,
  page,
}) => {
  await setupAuthMocks(context);
  await setupTemplateMocks(context, { categories: [MOCK_CATEGORY] });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await test.step("Navigate to settings page", async () => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible({
      timeout: 15000,
    });
    await screenshot(page, "f4-01-settings-page-loaded");
  });

  await test.step("Default tab is SMS Templates", async () => {
    const smsTab = page.getByRole("tab", { name: /sms templates/i });
    await expect(smsTab).toBeVisible({ timeout: 5000 });
    await expect(smsTab).toHaveAttribute("aria-selected", "true");
    await screenshot(page, "f4-02-sms-templates-tab-active");
  });

  await test.step("Click Template Categories tab", async () => {
    await page.getByRole("tab", { name: /template categories/i }).click();
    await screenshot(page, "f4-03-categories-tab-clicked");
  });

  await test.step("Template Categories section renders", async () => {
    await expect(
      page.getByRole("tab", { name: /template categories/i }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { name: /template categories/i }),
    ).toBeVisible({ timeout: 8000 });
    await screenshot(page, "f4-04-categories-section-visible");
  });

  await test.step("CategoryManager components are present", async () => {
    // Input for new category
    await expect(page.getByLabel("New category name")).toBeVisible({
      timeout: 8000,
    });
    // Add button
    await expect(
      page.getByRole("button", { name: /create category/i }),
    ).toBeVisible();
    // Category list heading
    await expect(page.getByText("Existing Categories")).toBeVisible();
    await screenshot(page, "f4-05-category-manager-rendered");
  });

  await test.step("Existing mock category is shown in list", async () => {
    await expect(
      page.getByRole("list", { name: /template categories/i }),
    ).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Follow Up")).toBeVisible();
    await screenshot(page, "f4-06-mock-category-shown");
  });

  await test.step("Check for console errors", async () => {
    const relevant = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("localhost:3000") &&
        !e.includes("net::ERR"),
    );
    console.log("[F4] Console errors:", relevant);
    expect(relevant, "No unexpected console errors in Flow 4").toHaveLength(0);
  });
});

// ===========================================================================
// FLOW 5 — Create new category
// ===========================================================================
test("Flow 5: Create a new template category", async ({ context, page }) => {
  await setupAuthMocks(context);

  let capturedCategoryBody: Record<string, unknown> = {};
  await setupTemplateMocks(context, {
    categories: [],
    captureCreateCategory: (body) => {
      capturedCategoryBody = body;
    },
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await test.step("Navigate to settings → Template Categories", async () => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("tab", { name: /template categories/i }).click();
    await expect(page.getByLabel("New category name")).toBeVisible({
      timeout: 8000,
    });
    await screenshot(page, "f5-01-categories-tab-open");
  });

  await test.step("Empty state shows no categories message", async () => {
    await expect(page.getByText(/no categories yet/i)).toBeVisible({
      timeout: 5000,
    });
    await screenshot(page, "f5-02-empty-categories");
  });

  await test.step("Type new category name", async () => {
    const input = page.getByLabel("New category name");
    await input.fill("Discharge Instructions");
    await expect(input).toHaveValue("Discharge Instructions");
    await screenshot(page, "f5-03-category-name-typed");
  });

  await test.step("Add button is enabled when name is entered", async () => {
    const addBtn = page.getByRole("button", { name: /create category/i });
    await expect(addBtn).toBeEnabled();
  });

  await test.step("Click Add button to create category", async () => {
    await page.getByRole("button", { name: /create category/i }).click();
    await screenshot(page, "f5-04-create-button-clicked");
  });

  await test.step("Verify API call was made with correct name", async () => {
    // Give the mock a moment to register
    await page.waitForTimeout(500);
    console.log(
      "[F5] Captured POST body:",
      JSON.stringify(capturedCategoryBody),
    );
    expect(capturedCategoryBody).toMatchObject({
      name: "Discharge Instructions",
    });
  });

  await test.step("Input is cleared after creation", async () => {
    // After success, input should be reset to empty
    await expect(page.getByLabel("New category name")).toHaveValue("", {
      timeout: 5000,
    });
    await screenshot(page, "f5-05-input-cleared-after-create");
  });

  await test.step("Check for console errors", async () => {
    const relevant = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("localhost:3000") &&
        !e.includes("net::ERR"),
    );
    console.log("[F5] Console errors:", relevant);
    expect(relevant, "No unexpected console errors in Flow 5").toHaveLength(0);
  });
});

// ===========================================================================
// FLOW 6 — Delete category with confirmation dialog
// ===========================================================================
test("Flow 6: Delete category shows confirmation dialog", async ({
  context,
  page,
}) => {
  await setupAuthMocks(context);
  await setupTemplateMocks(context, {
    categories: [
      MOCK_CATEGORY,
      {
        id: "cat-002",
        name: "Pre-Op Instructions",
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await test.step("Navigate to settings → Template Categories", async () => {
    await page.goto(SETTINGS_URL, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole("tab", { name: /template categories/i }).click();
    await expect(
      page.getByRole("list", { name: /template categories/i }),
    ).toBeVisible({ timeout: 10000 });
    await screenshot(page, "f6-01-categories-loaded");
  });

  await test.step("Both mock categories are listed", async () => {
    await expect(page.getByText("Follow Up")).toBeVisible();
    await expect(page.getByText("Pre-Op Instructions")).toBeVisible();
    await screenshot(page, "f6-02-both-categories-listed");
  });

  await test.step("Click delete icon for 'Follow Up'", async () => {
    const deleteBtn = page.getByRole("button", {
      name: /delete category follow up/i,
    });
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();
    await screenshot(page, "f6-03-delete-icon-clicked");
  });

  await test.step("Confirmation modal appears", async () => {
    // Modal should show with the category name
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 5000 });
    await screenshot(page, "f6-04-confirmation-modal-open");
  });

  await test.step("Modal contains correct warning text", async () => {
    await expect(page.getByText(/delete "follow up"/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/this cannot be undone/i)).toBeVisible();
    await expect(
      page.getByText(/categories in use by templates cannot be deleted/i),
    ).toBeVisible();
    await screenshot(page, "f6-05-modal-content-verified");
  });

  await test.step("Cancel button dismisses modal", async () => {
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    await screenshot(page, "f6-06-modal-dismissed-by-cancel");
  });

  await test.step("Re-open confirmation and confirm delete", async () => {
    const deleteBtn = page.getByRole("button", {
      name: /delete category follow up/i,
    });
    await deleteBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Click the Delete (failure/red) button
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^delete$/i })
      .click();
    await screenshot(page, "f6-07-confirm-delete-clicked");
  });

  await test.step("Modal closes after confirmed delete", async () => {
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 8000 });
    await screenshot(page, "f6-08-modal-closed-after-delete");
  });

  await test.step("Check for console errors", async () => {
    const relevant = consoleErrors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("localhost:3000") &&
        !e.includes("net::ERR"),
    );
    console.log("[F6] Console errors:", relevant);
    expect(relevant, "No unexpected console errors in Flow 6").toHaveLength(0);
  });
});
