import { test, expect } from "@playwright/test";
import path from "path";

const BASE_URL = "http://localhost:3001/outreach";
const CONVERSATIONS_URL = `${BASE_URL}/conversations`;
const FIXTURES_DIR = path.resolve(__dirname, "fixtures");

test("Scenario 5 diagnostic", async ({ context, page }) => {
  const saxRoleId = "test-sax-role-uuid-0001";
  const saxId = 42;

  const requests: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("conv-mms") || url.includes("messages")) {
      requests.push(`[${req.method()}] ${url}`);
    }
  });

  await context.route("**/auth/profile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sub: "test",
        email: "test@example.com",
        sax_id: saxId,
        tenant_id: "t1",
        practice_id: "p1",
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
        tenant_id: "t1",
        practice_id: "p1",
      }),
    });
  });
  await context.route("**/api/auth/set-cookie**", async (route) => {
    await route.fulfill({ status: 200, body: "ok" });
  });
  await context.route("**/api/roles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ role_id: saxRoleId, name: "Sax", active: true }]),
    });
  });
  await context.route("**/api/users/*/roles**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          sax_id: String(saxId),
          role_id: saxRoleId,
          active: true,
          assigned_on: new Date().toISOString(),
          assigned_by: "test",
          removed_on: null,
          removed_by: null,
        },
      ]),
    });
  });
  await context.route("**/api/track-login**", async (route) => {
    await route.fulfill({ status: 200, body: "ok" });
  });
  await context.route("**/api/outreach/templates**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [], pagination: { total: 0 } }),
    });
  });
  await context.addInitScript(
    ({ roleId, sid }: { roleId: string; sid: number }) => {
      localStorage.setItem(
        "user_roles",
        JSON.stringify([
          {
            sax_id: String(sid),
            role_id: roleId,
            active: true,
            assigned_on: new Date().toISOString(),
            assigned_by: "test",
            removed_on: null,
            removed_by: null,
          },
        ]),
      );
      localStorage.setItem(
        "all_roles",
        JSON.stringify([{ role_id: roleId, name: "Sax", active: true }]),
      );
    },
    { roleId: saxRoleId, sid: saxId },
  );

  await context.route("**/api/outreach/conversations?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "conv-mms-001",
            friendlyName: "MMS Test Patient",
            patientPhone: "+15551234567",
            status: "active",
            unreadCount: 0,
            lastMessageAt: new Date().toISOString(),
            slaStatus: "ok",
            coordinatorSaxId: 42,
            practiceId: "practice-001",
            tenantId: "tenant-001",
            channel: "sms",
          },
        ],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      }),
    });
  });

  await context.route(
    new RegExp("api/outreach/conversations/conv-mms-001(/messages)?"),
    async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes("/messages") && method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [],
            pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
          }),
        });
        return;
      }
      if (url.includes("/messages") && method === "POST") {
        console.log("[CONV-MOCK] POST /messages hit - continuing");
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "conv-mms-001",
            friendlyName: "MMS Test Patient",
            patientPhone: "+15551234567",
            status: "active",
            unreadCount: 0,
            lastMessageAt: new Date().toISOString(),
            slaStatus: "ok",
            coordinatorSaxId: 42,
            practiceId: "practice-001",
            tenantId: "tenant-001",
            channel: "sms",
          },
        }),
      });
    },
  );

  await context.route(
    "**/api/outreach/conversations/conv-mms-001/messages",
    async (route) => {
      const method = route.request().method();
      if (method !== "POST") {
        await route.continue();
        return;
      }
      const body = route.request().postDataJSON();
      console.log(
        "[SEND-MOCK] Intercepted POST /messages:",
        JSON.stringify(body),
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "msg-test",
          body: body?.body || "",
          direction: "outbound",
          createdAt: new Date().toISOString(),
          status: "queued",
          media: [],
        }),
      });
    },
  );

  await context.route("**/api/outreach/media/upload", async (route) => {
    const method = route.request().method();
    if (method !== "POST") {
      await route.continue();
      return;
    }
    const body = route.request().postDataJSON();
    const s3Key = `media/pending/conv-mms-001/test-${body?.filename}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        presignedUrl: `https://mock-s3.example.com/upload?key=${encodeURIComponent(s3Key)}`,
        s3Key,
      }),
    });
  });
  await context.route("https://mock-s3.example.com/**", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });
  await context.route(
    "**/api/outreach/conversations/conv-mms-001/read",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    },
  );

  await page.goto(`${CONVERSATIONS_URL}/conv-mms-001`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByLabel("Message input")).toBeVisible({
    timeout: 15000,
  });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(FIXTURES_DIR, "test-image-1.jpg"));
  await expect(page.getByText("complete")).toBeVisible({ timeout: 10000 });

  const sendButton = page.getByLabel("Send message");
  await expect(sendButton).toBeEnabled();
  await sendButton.click();
  await page.waitForTimeout(2000);

  console.log("=== REQUESTS ===");
  for (const r of requests) {
    console.log(r);
  }
});
