import { test, expect, type Page, type Request } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const SLEEPCONNECT_URL =
  process.env.NEXT_PUBLIC_SLEEPCONNECT_URL ?? "http://localhost:3000";

const DC_USER = process.env.DC_USER ?? "dan@sleeparchitects.com";
const DC_PASSWORD = process.env.DC_PASSWORD ?? "6mDYOtAsYYx#D@";

const EVIDENCE_DIR = path.resolve(
  __dirname,
  "../.sisyphus/evidence/mms-e2e-real",
);
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const FIXTURE_IMAGE = path.resolve(__dirname, "fixtures/test-image-1.jpg");

async function shot(page: Page, name: string): Promise<void> {
  const p = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`[EVIDENCE] 📸 ${name}.png`);
}

interface UploadReq {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
  status?: number;
}

interface SendReq {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
  status?: number;
}

test.describe("MMS Send Flow – Real E2E (no mocks)", () => {
  test.setTimeout(120_000);

  test("Upload includes filename/contentType/conversationId; send includes mediaKeys", async ({
    page,
  }) => {
    const uploadRequests: UploadReq[] = [];
    const sendRequests: SendReq[] = [];

    page.on("request", (req: Request) => {
      if (req.url().includes("/media/upload") && req.method() === "POST") {
        let body: Record<string, unknown> | null = null;
        try {
          body = req.postDataJSON() as Record<string, unknown>;
        } catch {
          /* ignore */
        }
        uploadRequests.push({ url: req.url(), method: req.method(), body });
        console.log(
          `[NETWORK-TAP] UPLOAD REQUEST → ${req.url()}\n  body: ${JSON.stringify(body)}`,
        );
      }
    });

    page.on("request", (req: Request) => {
      if (
        req.url().includes("/conversations/") &&
        req.url().includes("/messages") &&
        req.method() === "POST"
      ) {
        let body: Record<string, unknown> | null = null;
        try {
          body = req.postDataJSON() as Record<string, unknown>;
        } catch {
          /* ignore */
        }
        sendRequests.push({ url: req.url(), method: req.method(), body });
        console.log(
          `[NETWORK-TAP] SEND REQUEST → ${req.url()}\n  body: ${JSON.stringify(body)}`,
        );
      }
    });

    page.on("response", async (res) => {
      if (res.url().includes("/media/upload")) {
        let bodyText: string;
        try {
          bodyText = await res.text();
        } catch {
          bodyText = "<unreadable>";
        }
        const last = uploadRequests[uploadRequests.length - 1];
        if (last) last.status = res.status();
        console.log(
          `[NETWORK-TAP] UPLOAD RESPONSE ← HTTP ${res.status()} ${res.url()}\n  body: ${bodyText}`,
        );
      }
      if (
        res.url().includes("/conversations/") &&
        res.url().includes("/messages") &&
        !res.url().includes("?")
      ) {
        const last = sendRequests[sendRequests.length - 1];
        if (last) last.status = res.status();
        let bodyText: string;
        try {
          bodyText = await res.text();
        } catch {
          bodyText = "<unreadable>";
        }
        console.log(
          `[NETWORK-TAP] SEND RESPONSE ← HTTP ${res.status()} ${res.url()}\n  body: ${bodyText}`,
        );
      }
    });

    await test.step("Login via SleepConnect + Auth0 OAuth flow", async () => {
      await page.goto(`${SLEEPCONNECT_URL}/login`, {
        waitUntil: "networkidle",
        timeout: 20_000,
      });
      await shot(page, "01-login-page");
      console.log(`[AUTH] On login page: ${page.url()}`);

      const ssoButton = page.getByRole("button", {
        name: /sign in to dream connect/i,
      });
      const hasSSOButton = await ssoButton.count();

      if (hasSSOButton > 0) {
        console.log("[AUTH] Clicking SSO button …");
        await ssoButton.click();

        await page.waitForURL((url) => url.hostname.includes("auth0.com"), {
          timeout: 20_000,
        });
        await shot(page, "02-auth0-page");
        console.log(`[AUTH] At Auth0: ${page.url()}`);

        // Step 1: Fill email and click Continue (identifier-first flow)
        const emailInput = page
          .locator(
            'input[type="email"], input[name="email"], input[name="username"], input[id="1-email"]',
          )
          .first();
        await expect(emailInput).toBeVisible({ timeout: 15_000 });
        await emailInput.fill(DC_USER);
        await shot(page, "03a-auth0-email-filled");

        const continueBtn = page
          .getByRole("button", {
            name: /continue/i,
          })
          .or(page.locator('button[type="submit"]'))
          .first();
        await continueBtn.click();
        console.log("[AUTH] Auth0 email submitted, waiting for password …");

        // Step 2: Wait for password field (second screen) and fill it
        const passwordInput = page
          .locator(
            'input[type="password"]:not([aria-hidden="true"]):not(.hide)',
          )
          .first();
        await expect(passwordInput).toBeVisible({ timeout: 15_000 });
        await passwordInput.fill(DC_PASSWORD);
        await shot(page, "03b-auth0-password-filled");

        const signInBtn = page
          .getByRole("button", {
            name: /continue|sign in|log in|submit/i,
          })
          .or(page.locator('button[type="submit"]'))
          .first();
        await signInBtn.click();
        console.log("[AUTH] Auth0 credentials submitted …");
      } else {
        console.log("[AUTH] No SSO button — trying direct form …");
        const emailInput = page
          .locator(
            'input[type="email"], input[name="email"], input[name="username"]',
          )
          .first();
        const hasEmailInput = await emailInput.count();
        if (hasEmailInput > 0) {
          await emailInput.fill(DC_USER);
          const passwordInput = page.locator('input[type="password"]').first();
          await passwordInput.fill(DC_PASSWORD);
          await shot(page, "03-direct-creds-filled");
          const submitBtn = page
            .getByRole("button", {
              name: /sign in|log in|login|submit|continue/i,
            })
            .or(page.locator('button[type="submit"]'))
            .first();
          await submitBtn.click();
        } else {
          await shot(page, "03-no-form");
          throw new Error(`No login form at ${page.url()}`);
        }
      }

      await page.waitForURL(
        (url) =>
          !url.hostname.includes("auth0.com") &&
          !url.pathname.includes("/login"),
        { timeout: 30_000 },
      );
      console.log(`[AUTH] Logged in — now at: ${page.url()}`);
      await shot(page, "04-after-login");
    });

    await test.step("Seed SAX role in outreach app localStorage", async () => {
      const saxRoleId = "sax-role-e2e-test-id";
      await page.goto(`${BASE_URL}/outreach/conversations`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      await page.evaluate((roleId: string) => {
        const saxRole = {
          role_id: roleId,
          name: "Sax",
          description: "SAX employees",
          active: true,
        };
        const userRole = {
          sax_id: "1",
          role_id: roleId,
          assigned_on: "2024-01-01",
          assigned_by: "system",
          removed_on: null,
          removed_by: null,
          active: true,
        };
        localStorage.setItem("all_roles", JSON.stringify([saxRole]));
        localStorage.setItem("user_roles", JSON.stringify([userRole]));
      }, saxRoleId);
      console.log("[AUTH] SAX role seeded into localStorage for outreach app");
    });

    await test.step("Navigate to conversations list", async () => {
      const conversationsUrl = `${BASE_URL}/outreach/conversations`;
      console.log(`[NAV] Going to ${conversationsUrl}`);
      await page.goto(conversationsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      await expect(page).not.toHaveURL(/login/, { timeout: 10_000 });
      console.log(`[NAV] Arrived at: ${page.url()}`);
      await shot(page, "05-conversations-list");
    });

    let conversationId = "";

    await test.step("Open first conversation", async () => {
      const convItem = page
        .getByRole("button", { name: /Conversation with/i })
        .first();

      await convItem.waitFor({ state: "visible", timeout: 30_000 });
      await shot(page, "06-conversations-loaded");

      await convItem.click();
      await page.waitForURL(/conversations\/[^/]+/, { timeout: 15_000 });
      const urlMatch = page.url().match(/conversations\/([^/?#]+)/);
      conversationId = urlMatch?.[1] ?? "";
      console.log(`[NAV] Opened conversation: ${conversationId}`);
      await shot(page, "07-conversation-opened");
    });

    await test.step("Attach image file (triggers upload)", async () => {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: "attached", timeout: 15_000 });
      console.log(`[UPLOAD] Setting file: ${FIXTURE_IMAGE}`);
      await fileInput.setInputFiles(FIXTURE_IMAGE);
      await shot(page, "08-file-attached");

      const start = Date.now();
      while (uploadRequests.length === 0 && Date.now() - start < 12_000) {
        await page.waitForTimeout(300);
      }
      await shot(page, "09-after-upload-attempt");
    });

    await test.step("Send message with media", async () => {
      const messageInput = page
        .getByRole("textbox", { name: /message|type/i })
        .or(page.locator('textarea, [contenteditable="true"]').first());

      const hasInput = await messageInput.count();
      if (hasInput > 0) {
        await messageInput.fill("E2E QA: MMS test");
      }
      await shot(page, "10-message-composed");

      const sendBtn = page
        .getByRole("button", { name: /send/i })
        .or(
          page.locator('[aria-label*="send" i], [data-testid*="send"]').first(),
        );

      await expect(sendBtn).toBeVisible({ timeout: 10_000 });
      await sendBtn.click();
      console.log("[SEND] Clicked send");

      const start = Date.now();
      while (sendRequests.length === 0 && Date.now() - start < 12_000) {
        await page.waitForTimeout(300);
      }
      await shot(page, "11-after-send");
    });

    await test.step("Assert: upload body has filename/contentType/conversationId", () => {
      console.log("\n=== UPLOAD REQUESTS ===");
      uploadRequests.forEach((r, i) => {
        console.log(
          `[${i}] ${r.method} ${r.url} HTTP:${r.status ?? "?"} body:${JSON.stringify(r.body)}`,
        );
      });
      console.log("=======================\n");

      expect(
        uploadRequests.length,
        "Expected ≥1 upload request",
      ).toBeGreaterThan(0);

      const req = uploadRequests[0];
      expect(
        req.status,
        `Upload HTTP ${req.status} should not be 400`,
      ).not.toBe(400);
      expect(req.status, `Upload should return 200, got ${req.status}`).toBe(
        200,
      );

      const b = req.body;
      expect(b, "Upload body not null").not.toBeNull();
      expect(b?.filename, "filename present").toBeTruthy();
      expect(b?.contentType, "contentType present").toBeTruthy();
      expect(b?.conversationId, "conversationId present").toBeTruthy();

      expect(String(b?.filename), "filename matches fixture").toContain(
        "test-image-1",
      );
      expect(String(b?.contentType), "contentType is image/*").toMatch(
        /^image\//,
      );
      expect(
        String(b?.conversationId).length,
        "conversationId non-empty",
      ).toBeGreaterThan(0);

      console.log("✅ [PASS] Upload body valid:", {
        filename: b?.filename,
        contentType: b?.contentType,
        conversationId: b?.conversationId,
      });
    });

    await test.step("Assert: send body includes mediaKeys[]", () => {
      console.log("\n=== SEND REQUESTS ===");
      sendRequests.forEach((r, i) => {
        console.log(
          `[${i}] ${r.method} ${r.url} HTTP:${r.status ?? "?"} body:${JSON.stringify(r.body)}`,
        );
      });
      console.log("=====================\n");

      expect(sendRequests.length, "Expected ≥1 send request").toBeGreaterThan(
        0,
      );

      const req = sendRequests[0];
      expect(req.status, `Send HTTP ${req.status} should not be 400`).not.toBe(
        400,
      );

      const b = req.body;
      expect(b, "Send body not null").not.toBeNull();

      const mediaKeys = b?.mediaKeys as unknown[];
      expect(Array.isArray(mediaKeys), "mediaKeys is array").toBe(true);
      expect(mediaKeys.length, "mediaKeys non-empty").toBeGreaterThan(0);

      console.log("✅ [PASS] Send body valid:", {
        mediaKeys,
        body: b?.body,
      });
    });

    await shot(page, "12-test-complete");
    console.log("\n╔═══════════════════════════════╗");
    console.log("║  MMS E2E VERIFICATION: PASS ✅ ║");
    console.log("╚═══════════════════════════════╝");
    console.log(`Evidence: ${EVIDENCE_DIR}`);
  });
});
