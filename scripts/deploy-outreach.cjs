#!/usr/bin/env node
/**
 * Outreach SMS App Deployment
 * Deploys Outreach Next.js app to AWS Lambda using OpenNext + AWS SDK
 *
 * Usage:
 *   node scripts/deploy-outreach.cjs [environment] [--skip-build]
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");
const util = require("util");
const {
  LambdaClient,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  PublishVersionCommand,
  UpdateAliasCommand,
  TagResourceCommand,
  GetFunctionCommand,
  CreateFunctionCommand,
  CreateAliasCommand,
} = require("@aws-sdk/client-lambda");
const {
  CloudFrontClient,
  CreateInvalidationCommand,
  ListDistributionsCommand,
  GetDistributionConfigCommand,
  GetCachePolicyCommand,
} = require("@aws-sdk/client-cloudfront");
const { IAMClient, GetRoleCommand } = require("@aws-sdk/client-iam");
const {
  S3Client,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
} = require("@aws-sdk/client-s3");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");
const { getResourceNames } = require("./aws-config");

const REGION = "us-east-1";
const lambda = new LambdaClient({ region: REGION });
const cloudfront = new CloudFrontClient({ region: REGION });
const iam = new IAMClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const sts = new STSClient({ region: REGION });

// Parse args
const args = process.argv.slice(2);
const environment = args.find((a) => !a.startsWith("--")) || "develop";
const skipBuild = args.includes("--skip-build");

// 1. Load Environment Variables (Coalescing)
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`🚀 Deploying to [${environment}]`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// Load .env (base)
dotenv.config({ path: ".env" });

// Helper to load env file overrides
const loadEnvOverride = (file) => {
  if (fs.existsSync(file)) {
    console.log(`Tb Loading ${file} overrides`);
    const envConfig = dotenv.parse(fs.readFileSync(file));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }
};

// Load .env.local (local overrides/secrets)
// Loaded BEFORE env-specific config so that target environment config (e.g. URLs) takes precedence
loadEnvOverride(".env.local");

// Load environment-specific .env (e.g. .env.staging)
// This overwrites .env.local for defined keys (crucial for URLs)
loadEnvOverride(`.env.${environment}`);

// Get resource names for this environment
let resources;
try {
  resources = getResourceNames(environment);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

// 2. Validate Infrastructure
console.log("\n🔍 Checking infrastructure...");
try {
  const checkResult = execSync(
    `node scripts/check-infrastructure.cjs ${environment}`,
    { encoding: "utf8" },
  );
  const match = checkResult.match(/JSON_OUTPUT=(.*)/);
  if (match) {
    const status = JSON.parse(match[1]);
    if (!status.ready) {
      console.warn(
        "⚠️  Infrastructure check reported issues. Attempting deployment anyway (Lambda creation might be needed)...",
      );
      console.warn("   Missing:", status.missing.join(", "));
    }
  } else {
    console.warn(
      "⚠️ Could not parse infrastructure check output. Proceeding with caution...",
    );
  }
} catch (e) {
  // Check failed (exit code 1), but extract status from stdout
  const output = e.stdout?.toString() || "";
  const match = output.match(/JSON_OUTPUT=(.*)/);
  if (match) {
    const status = JSON.parse(match[1]);
    console.warn(
      "⚠️  Infrastructure check reported issues. Attempting deployment anyway (Lambda creation might be needed)...",
    );
    console.warn("   Missing:", status.missing.join(", "));
  } else {
    console.error("❌ Infrastructure check failed with no parseable output");
    console.error(e.message);
    process.exit(1);
  }
}

// 3. Validate Required Env Vars
// CRITICAL: These must ALL be set or the Lambda will be misconfigured
// AUTH0_* secrets MUST match SleepConnect for JWT verification to work
const requiredVars = [
  // Auth0 - MUST match SleepConnect values for same environment
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "AUTH0_DOMAIN",
  "AUTH0_BASE_URL",
  // Twilio
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  // App URLs
  "NEXT_PUBLIC_APP_BASE_URL",
  "NEXT_PUBLIC_SLEEPCONNECT_URL",
  "NEXT_PUBLIC_BASE_PATH",
];

// Optional vars - used by code but may have fallback defaults
const optionalVars = [
  "API_BASE_URL", // Used by 29 files - falls back to NEXT_PUBLIC_APP_BASE_URL
  "NEXT_PUBLIC_WS_API_URL", // WebSocket endpoint for real-time messages
  "TWILIO_FROM_NUMBER", // Used for sending SMS - required for SMS features
  "TWILIO_MESSAGING_SERVICE_SID", // Alternative to FROM_NUMBER
  "ENABLE_SLA_MONITORING", // Feature flag, defaults to false
  "NEXT_PUBLIC_PRACTICE_NAME", // Display name, has default
];
const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// Warn about missing optional vars
const missingOptional = optionalVars.filter((v) => !process.env[v]);
if (missingOptional.length > 0) {
  console.warn(
    `⚠️  Optional env vars not set (may use defaults): ${missingOptional.join(", ")}`,
  );
}

// Async Main Execution
(async () => {
  try {
    const workspaceRoot = path.join(__dirname, "..");

    // 4. Build
    if (!skipBuild) {
      console.log("\n📦 Building with OpenNext...");

      await new Promise((resolve, reject) => {
        const build = spawn("npx", ["@opennextjs/aws@3.6.6", "build"], {
          cwd: workspaceRoot,
          env: {
            ...process.env,
            NODE_ENV: "production",
            NODE_OPTIONS: "--max-old-space-size=4096",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });

        const filterLog = (data) => {
          const str = data.toString();
          // Strip ANSI codes (robust regex for colors/styles)
          const clean = util.stripVTControlCharacters
            ? util.stripVTControlCharacters(str)
            : str.replace(new RegExp("\\x1b\\[[0-9;]*m", "g"), "");

          if (
            clean.includes("Dynamic server usage:") ||
            clean.includes("[Auth Profile Proxy] Error") ||
            clean.includes(
              "Route /auth/profile couldn't be rendered statically",
            )
          ) {
            return false;
          }
          return true;
        };

        // Filter stdout for noise
        build.stdout.on("data", (data) => {
          if (filterLog(data)) {
            process.stdout.write(data);
          }
        });

        // Pass through stderr with filtering
        build.stderr.on("data", (data) => {
          if (filterLog(data)) {
            process.stderr.write(data);
          }
        });

        build.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Build failed with code ${code}`));
        });
      });

      // Fix pnpm symlinks
      const nodeModulesPath = path.join(
        workspaceRoot,
        ".open-next/server-functions/default/node_modules",
      );
      if (fs.existsSync(path.join(nodeModulesPath, ".pnpm"))) {
        const pnpmDirs = fs.readdirSync(path.join(nodeModulesPath, ".pnpm"));
        const styledJsx = pnpmDirs.find((d) => d.startsWith("styled-jsx@"));
        if (
          styledJsx &&
          !fs.existsSync(path.join(nodeModulesPath, "styled-jsx"))
        ) {
          fs.symlinkSync(
            path.join(".pnpm", styledJsx, "node_modules", "styled-jsx"),
            path.join(nodeModulesPath, "styled-jsx"),
            "dir",
          );
        }
      }
    }

    // 5. Zip
    console.log("\n🗜️  Zipping function...");
    const openNextDir = path.join(workspaceRoot, ".open-next");
    const zipFile = path.join(openNextDir, "function.zip");
    execSync(
      `cd "${path.join(openNextDir, "server-functions/default")}" && zip -ry "${zipFile}" . -q`,
      { stdio: "inherit" },
    );

    // 6. Deploy Lambda
    console.log(`\n☁️  Deploying Lambda: ${resources.lambdaName}`);

    // Check if function exists and get current config
    let exists = false;
    let existingEnvVars = {};
    try {
      const existingFn = await lambda.send(
        new GetFunctionCommand({ FunctionName: resources.lambdaName }),
      );
      exists = true;
      existingEnvVars = existingFn.Configuration?.Environment?.Variables || {};
      console.log(
        `   Existing env var keys: ${Object.keys(existingEnvVars).join(", ")}`,
      );
    } catch (e) {
      if (e.name !== "ResourceNotFoundException") throw e;
    }

    // Build new env vars - MERGE with existing to avoid losing manually-set vars
    // Priority: new explicit values > existing values
    const newEnvVars = {
      // Fixed values for all deployments
      NODE_ENV: "production",
      ENVIRONMENT: environment,
      MULTI_ZONE_MODE: "true",
      NEXT_PUBLIC_BASE_PATH: "/outreach",
      // Required vars from process.env
      ...requiredVars.reduce((acc, k) => ({ ...acc, [k]: process.env[k] }), {}),
      // Optional vars - only set if provided in process.env
      ...optionalVars.reduce((acc, k) => {
        if (process.env[k]) {
          acc[k] = process.env[k];
        }
        return acc;
      }, {}),
    };

    // MERGE: existing env vars are preserved unless explicitly overwritten
    // This prevents losing vars that were set manually on Lambda
    const lambdaEnvVars = {
      ...existingEnvVars, // Existing vars first (will be overwritten if new value provided)
      ...newEnvVars, // New vars take precedence
    };

    // Log what's changing
    const changedKeys = Object.keys(newEnvVars).filter(
      (k) => existingEnvVars[k] !== newEnvVars[k],
    );
    if (changedKeys.length > 0) {
      console.log(`   Updating env vars: ${changedKeys.join(", ")}`);
    }

    let functionArn;

    if (exists) {
      console.log("   Function exists. Updating code...");
      await lambda.send(
        new UpdateFunctionCodeCommand({
          FunctionName: resources.lambdaName,
          ZipFile: fs.readFileSync(zipFile),
        }),
      );

      // Wait for update
      let ready = false;
      while (!ready) {
        await new Promise((r) => setTimeout(r, 2000));
        const fn = await lambda.send(
          new GetFunctionCommand({ FunctionName: resources.lambdaName }),
        );
        if (fn.Configuration.LastUpdateStatus === "Successful") {
          ready = true;
          functionArn = fn.Configuration.FunctionArn;
        }
        if (fn.Configuration.LastUpdateStatus === "Failed")
          throw new Error("Lambda update failed");
      }

      console.log("   Updating configuration...");
      await lambda.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: resources.lambdaName,
          Environment: { Variables: lambdaEnvVars },
        }),
      );
    } else {
      console.log("   Function does not exist. Creating...");

      // Get Role ARN
      console.log(`   Looking up role: ${resources.roleName}`);
      const role = await iam.send(
        new GetRoleCommand({ RoleName: resources.roleName }),
      );
      const roleArn = role.Role.Arn;

      const createResult = await lambda.send(
        new CreateFunctionCommand({
          FunctionName: resources.lambdaName,
          Runtime: "nodejs20.x",
          Role: roleArn,
          Handler: "index.handler", // OpenNext default
          Code: { ZipFile: fs.readFileSync(zipFile) },
          Environment: { Variables: lambdaEnvVars },
          Timeout: 30,
          MemorySize: environment === "production" ? 2048 : 1024,
          Architectures: ["x86_64"],
          Tags: resources.tags,
        }),
      );
      functionArn = createResult.FunctionArn;
      console.log("   Function created.");
    }

    // Wait for stability
    await new Promise((r) => setTimeout(r, 5000));

    // Publish Version
    console.log("   Publishing version...");
    const version = await lambda.send(
      new PublishVersionCommand({
        FunctionName: resources.lambdaName,
        Description: `Deploy ${new Date().toISOString()}`,
      }),
    );
    console.log(`   🚀 Published v${version.Version}`);

    // Tag Resource
    const gitHash = execSync("git rev-parse --short HEAD").toString().trim();
    // We tag the function ARN, not the version/alias (which often fails or is unsupported for alias tags depending on context)
    // Actually, tagging the function itself is best.
    // The previous error "Tags on function aliases and versions are not supported" implies we should tag the main function ARN.
    // The `functionArn` variable is derived from GetFunction or CreateFunction.
    await lambda.send(
      new TagResourceCommand({
        Resource: functionArn,
        Tags: {
          GitCommit: gitHash,
          Deployer: process.env.USER || "ci",
        },
      }),
    );

    // Update Alias
    console.log('   Updating "live" alias...');
    try {
      await lambda.send(
        new UpdateAliasCommand({
          FunctionName: resources.lambdaName,
          Name: "live",
          FunctionVersion: version.Version,
        }),
      );
    } catch (e) {
      if (e.name === "ResourceNotFoundException") {
        await lambda.send(
          new CreateAliasCommand({
            FunctionName: resources.lambdaName,
            Name: "live",
            FunctionVersion: version.Version,
          }),
        );
        console.log('   Alias "live" created.');
      } else throw e;
    }

    // 7. S3 Sync (Assets) - NO DELETE
    console.log(`\n📤 Uploading assets to ${resources.bucketName}...`);
    const assetsDir = path.join(openNextDir, "assets");
    if (fs.existsSync(assetsDir)) {
      execSync(
        `aws s3 sync "${path.join(assetsDir, "_next")}" s3://${resources.bucketName}/outreach-static/_next --cache-control "public,max-age=31536000,immutable"`,
        { stdio: "inherit" },
      );
      execSync(
        `aws s3 sync "${assetsDir}" s3://${resources.bucketName}/outreach-static/ --exclude "_next/*" --cache-control "public,max-age=86400"`,
        { stdio: "inherit" },
      );
    }

    // 7b. Ensure S3 Bucket Policy for CloudFront OAC Access
    console.log("\n🔐 Verifying S3 bucket policy for CloudFront access...");

    // Get AWS account ID for policy
    const accountId = (await sts.send(new GetCallerIdentityCommand({})))
      .Account;

    // Find the SleepConnect CloudFront distribution for this environment
    // This is the distribution that needs access to the Outreach assets bucket
    const sleepConnectDomainMap = {
      production: "mydreamconnect.com",
      staging: "stage.mydreamconnect.com",
      develop: "dev.mydreamconnect.com",
    };
    const sleepConnectDomain =
      sleepConnectDomainMap[environment] || "dev.mydreamconnect.com";

    let sleepConnectDistId = null;
    let scMarker = undefined;
    do {
      const response = await cloudfront.send(
        new ListDistributionsCommand({ Marker: scMarker }),
      );
      if (response.DistributionList?.Items) {
        for (const dist of response.DistributionList.Items) {
          if (dist.Aliases?.Items?.includes(sleepConnectDomain)) {
            sleepConnectDistId = dist.Id;
            break;
          }
        }
      }
      scMarker = response.DistributionList?.NextMarker;
    } while (scMarker && !sleepConnectDistId);

    if (sleepConnectDistId) {
      console.log(`   Found SleepConnect Distribution: ${sleepConnectDistId}`);

      // Define the required bucket policy
      const bucketPolicy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AllowCloudFrontServicePrincipal",
            Effect: "Allow",
            Principal: {
              Service: "cloudfront.amazonaws.com",
            },
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${resources.bucketName}/*`,
            Condition: {
              StringEquals: {
                "AWS:SourceArn": `arn:aws:cloudfront::${accountId}:distribution/${sleepConnectDistId}`,
              },
            },
          },
        ],
      };

      // Check if policy needs updating
      let needsUpdate = false;
      try {
        const currentPolicy = await s3.send(
          new GetBucketPolicyCommand({ Bucket: resources.bucketName }),
        );
        const current = JSON.parse(currentPolicy.Policy);
        const required = JSON.stringify(bucketPolicy);
        const existing = JSON.stringify(current);

        if (required !== existing) {
          needsUpdate = true;
          console.log("   Bucket policy differs from required policy");
        } else {
          console.log("   ✅ Bucket policy is correct");
        }
      } catch (e) {
        if (e.name === "NoSuchBucketPolicy") {
          needsUpdate = true;
          console.log("   No bucket policy exists");
        } else {
          throw e;
        }
      }

      if (needsUpdate) {
        console.log("   Updating S3 bucket policy...");
        await s3.send(
          new PutBucketPolicyCommand({
            Bucket: resources.bucketName,
            Policy: JSON.stringify(bucketPolicy),
          }),
        );
        console.log("   ✅ S3 bucket policy updated");
      }
    } else {
      console.warn(
        `   ⚠️  Could not find SleepConnect CloudFront distribution (${sleepConnectDomain})`,
      );
      console.warn("   Skipping bucket policy update");
    }

    // 8. Invalidate CloudFront
    console.log("\n🔄 Invalidating CloudFront...");
    let distributionId = null;
    let found = false;
    let marker = undefined;

    // Attempt to find distribution by Alias
    do {
      const response = await cloudfront.send(
        new ListDistributionsCommand({ Marker: marker }),
      );
      if (response.DistributionList?.Items) {
        for (const dist of response.DistributionList.Items) {
          if (dist.Aliases?.Items?.includes(resources.domainName)) {
            found = true;
            distributionId = dist.Id;
            break;
          }
        }
      }
      marker = response.DistributionList?.NextMarker;
    } while (marker && !found);

    if (distributionId) {
      console.log(`   Found Distribution: ${distributionId}`);

      // Verify CloudFront compression is enabled (prevents 6MB payload errors)
      console.log("   Verifying CloudFront compression...");
      const {
        GetDistributionConfigCommand,
        GetCachePolicyCommand,
      } = require("@aws-sdk/client-cloudfront");

      try {
        const distConfig = await cloudfront.send(
          new GetDistributionConfigCommand({ Id: distributionId }),
        );
        const cachePolicyId =
          distConfig.DistributionConfig?.DefaultCacheBehavior?.CachePolicyId;

        if (cachePolicyId) {
          const cachePolicy = await cloudfront.send(
            new GetCachePolicyCommand({ Id: cachePolicyId }),
          );
          const gzipEnabled =
            cachePolicy.CachePolicy?.CachePolicyConfig
              ?.ParametersInCacheKeyAndForwardedToOrigin
              ?.EnableAcceptEncodingGzip;
          const brotliEnabled =
            cachePolicy.CachePolicy?.CachePolicyConfig
              ?.ParametersInCacheKeyAndForwardedToOrigin
              ?.EnableAcceptEncodingBrotli;

          if (!gzipEnabled && !brotliEnabled) {
            console.warn("   ⚠️  WARNING: CloudFront compression is DISABLED!");
            console.warn(
              "   This may cause Lambda payload size errors (>6MB) for large responses.",
            );
            console.warn(
              `   Cache Policy: ${cachePolicy.CachePolicy?.CachePolicyConfig?.Name} (${cachePolicyId})`,
            );
            console.warn(
              "   Recommendation: Enable gzip/brotli compression in CloudFront cache policy.",
            );
            console.warn(
              "   See docs/DEPLOYMENT_RUNBOOK.md for fix instructions.",
            );
          } else {
            console.log(
              `   ✅ Compression enabled (Gzip: ${gzipEnabled}, Brotli: ${brotliEnabled})`,
            );
          }
        }
      } catch (err) {
        console.warn(
          "   ⚠️  Could not verify CloudFront compression settings:",
          err.message,
        );
      }

      await cloudfront.send(
        new CreateInvalidationCommand({
          DistributionId: distributionId,
          InvalidationBatch: {
            CallerReference: `deploy-${Date.now()}`,
            Paths: {
              Quantity: 1,
              Items: ["/*"],
            },
          },
        }),
      );
      console.log("   ✅ Invalidation requested");
    } else {
      console.warn(
        "⚠️  Could not find CloudFront distribution for invalidation",
      );
      console.warn(`   Looked for alias: ${resources.domainName}`);
    }

    console.log("\n✅ Deployment Complete!");
    console.log(`🌍 URL: https://${resources.domainName}/outreach`);
  } catch (e) {
    console.error("\n❌ Deployment Failed:", e);
    process.exit(1);
  }
})();
