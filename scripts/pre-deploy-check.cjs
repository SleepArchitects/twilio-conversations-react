#!/usr/bin/env node
/**
 * Pre-deployment validation script for Outreach SMS App
 * Run this BEFORE deploying to catch configuration issues early
 *
 * Usage:
 *   node scripts/pre-deploy-check.cjs [environment]
 *
 * Checks:
 *   1. Required environment variables are set
 *   2. AWS Lambda exists and has required env var KEYS
 *   3. Auth0 secrets match SleepConnect (by key presence)
 *   4. GitHub secrets exist (if gh CLI available)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { LambdaClient, GetFunctionCommand } = require("@aws-sdk/client-lambda");

const REGION = "us-east-1";
const lambda = new LambdaClient({ region: REGION });

const args = process.argv.slice(2);
const environment = args[0] || "staging";

const ENV_CODES = {
  develop: "d",
  staging: "s",
  production: "p",
};

const SLEEPCONNECT_LAMBDAS = {
  staging: "sax-lambda-us-east-1-0x-s-sleep-connect-server_staging",
  production: "sax-lambda-us-east-1-0x-p-sleep-connect-server_production",
};

const OUTREACH_LAMBDAS = {
  develop: "sax-lambda-us-east-1-0x-d-outreach-server_develop",
  staging: "sax-lam-us-east-1-0x-s-outreach",
  production: "sax-lam-us-east-1-0x-p-outreach",
};

const REQUIRED_VARS = [
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "AUTH0_DOMAIN",
  "AUTH0_BASE_URL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "NEXT_PUBLIC_APP_BASE_URL",
  "NEXT_PUBLIC_SLEEPCONNECT_URL",
  "NEXT_PUBLIC_BASE_PATH",
];

const AUTH_SECRETS = ["AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"];

const LAMBDA_REQUIRED_KEYS = [
  "NODE_ENV",
  "ENVIRONMENT",
  "MULTI_ZONE_MODE",
  "NEXT_PUBLIC_BASE_PATH",
  ...REQUIRED_VARS,
];

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`🔍 Pre-Deploy Validation: ${environment.toUpperCase()}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

let hasErrors = false;
let hasWarnings = false;

function error(msg) {
  console.error(`❌ ${msg}`);
  hasErrors = true;
}

function warn(msg) {
  console.warn(`⚠️  ${msg}`);
  hasWarnings = true;
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

dotenv.config({ path: ".env" });
if (fs.existsSync(".env.local")) {
  const localEnv = dotenv.parse(fs.readFileSync(".env.local"));
  Object.assign(process.env, localEnv);
}
if (fs.existsSync(`.env.${environment}`)) {
  const envSpecific = dotenv.parse(fs.readFileSync(`.env.${environment}`));
  Object.assign(process.env, envSpecific);
}

async function checkLocalEnv() {
  console.log("\n📋 Local Environment Variables");
  console.log("──────────────────────────────────────────");

  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    error(`Missing required vars: ${missing.join(", ")}`);
  } else {
    ok("All required environment variables are set");
  }
}

async function checkLambdaEnvKeys() {
  console.log("\n📦 Lambda Environment Variable Keys");
  console.log("──────────────────────────────────────────");

  const lambdaName = OUTREACH_LAMBDAS[environment];
  if (!lambdaName) {
    error(`Unknown environment: ${environment}`);
    return;
  }

  try {
    const fn = await lambda.send(
      new GetFunctionCommand({ FunctionName: lambdaName }),
    );
    const envVars = fn.Configuration?.Environment?.Variables || {};
    const keys = Object.keys(envVars);

    info(`Lambda: ${lambdaName}`);
    info(`Current keys: ${keys.length}`);

    const missingKeys = LAMBDA_REQUIRED_KEYS.filter((k) => !keys.includes(k));
    if (missingKeys.length > 0) {
      error(`Lambda missing required keys: ${missingKeys.join(", ")}`);
    } else {
      ok("Lambda has all required env var keys");
    }
  } catch (e) {
    if (e.name === "ResourceNotFoundException") {
      warn(
        `Lambda ${lambdaName} does not exist yet (will be created on deploy)`,
      );
    } else {
      error(`Failed to check Lambda: ${e.message}`);
    }
  }
}

async function checkAuthSecretAlignment() {
  console.log("\n🔐 Auth Secret Key Alignment (Outreach vs SleepConnect)");
  console.log("──────────────────────────────────────────");

  if (environment === "develop") {
    info(
      "Skipping auth alignment check for develop (no SleepConnect lambda defined)",
    );
    return;
  }

  const outreachLambda = OUTREACH_LAMBDAS[environment];
  const sleepconnectLambda = SLEEPCONNECT_LAMBDAS[environment];

  if (!sleepconnectLambda) {
    warn(`No SleepConnect lambda defined for ${environment}`);
    return;
  }

  try {
    const [outreachFn, sleepconnectFn] = await Promise.all([
      lambda.send(new GetFunctionCommand({ FunctionName: outreachLambda })),
      lambda.send(new GetFunctionCommand({ FunctionName: sleepconnectLambda })),
    ]);

    const outreachKeys = Object.keys(
      outreachFn.Configuration?.Environment?.Variables || {},
    );
    const sleepconnectKeys = Object.keys(
      sleepconnectFn.Configuration?.Environment?.Variables || {},
    );

    info(`Outreach Lambda: ${outreachLambda}`);
    info(`SleepConnect Lambda: ${sleepconnectLambda}`);

    let allPresent = true;
    for (const key of AUTH_SECRETS) {
      const inOutreach = outreachKeys.includes(key);
      const inSleepConnect = sleepconnectKeys.includes(key);

      if (inOutreach && inSleepConnect) {
        ok(`${key}: Present in both (verify VALUES match manually)`);
      } else if (!inOutreach) {
        error(`${key}: MISSING from Outreach Lambda`);
        allPresent = false;
      } else if (!inSleepConnect) {
        warn(`${key}: Missing from SleepConnect Lambda (unexpected)`);
      }
    }

    if (allPresent) {
      console.log("");
      warn("Keys are present but VALUES must match for JWT verification!");
      info("Run this to compare (values hidden):");
      console.log(
        `   aws lambda get-function-configuration --function-name ${outreachLambda} --query 'Environment.Variables | keys(@)'`,
      );
      console.log(
        `   aws lambda get-function-configuration --function-name ${sleepconnectLambda} --query 'Environment.Variables | keys(@)'`,
      );
    }
  } catch (e) {
    if (e.name === "ResourceNotFoundException") {
      warn(`One or more Lambdas don't exist yet`);
    } else {
      error(`Failed to check auth alignment: ${e.message}`);
    }
  }
}

async function checkGitHubSecrets() {
  console.log("\n🔒 GitHub Secrets");
  console.log("──────────────────────────────────────────");

  try {
    execSync("which gh", { stdio: "pipe" });
  } catch {
    info("GitHub CLI (gh) not installed, skipping secrets check");
    return;
  }

  try {
    const repoSecrets = execSync("gh secret list --json name -q '.[].name'", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    info(`Repository secrets found: ${repoSecrets.length}`);

    const missingRepoSecrets = REQUIRED_VARS.filter(
      (v) => !repoSecrets.includes(v),
    );
    if (missingRepoSecrets.length > 0) {
      warn(`Missing repo-level secrets: ${missingRepoSecrets.join(", ")}`);
    } else {
      ok("All required secrets exist at repo level");
    }

    if (environment === "production") {
      try {
        const prodSecrets = execSync(
          "gh secret list --env production --json name -q '.[].name'",
          { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
        )
          .trim()
          .split("\n")
          .filter(Boolean);

        if (prodSecrets.length === 0) {
          warn(
            "No secrets in 'production' environment - will use repo defaults!",
          );
          warn("Production should have its own Auth0/Twilio credentials");
        } else {
          info(`Production environment secrets: ${prodSecrets.length}`);
          for (const key of AUTH_SECRETS) {
            if (prodSecrets.includes(key)) {
              ok(`${key}: Overridden in production environment`);
            } else {
              warn(`${key}: Using repo-level default (verify this is correct)`);
            }
          }
        }
      } catch (e) {
        warn("Could not check production environment secrets");
      }
    }
  } catch (e) {
    warn(`Could not check GitHub secrets: ${e.message}`);
  }
}

async function main() {
  await checkLocalEnv();
  await checkLambdaEnvKeys();
  await checkAuthSecretAlignment();
  await checkGitHubSecrets();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (hasErrors) {
    console.error("❌ Pre-deploy check FAILED - fix errors before deploying");
    process.exit(1);
  } else if (hasWarnings) {
    console.warn("⚠️  Pre-deploy check passed with WARNINGS");
    console.warn("   Review warnings before deploying to production");
    process.exit(0);
  } else {
    console.log("✅ Pre-deploy check PASSED");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
