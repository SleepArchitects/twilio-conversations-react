#!/usr/bin/env node
/**
 * Outreach SMS App Deployment (No SST)
 * Deploys Outreach Next.js app to AWS Lambda using OpenNext
 * 
 * Usage:
 *   node scripts/deploy-outreach.cjs [environment]
 * 
 * Examples:
 *   node scripts/deploy-outreach.cjs develop
 *   node scripts/deploy-outreach.cjs staging
 *   node scripts/deploy-outreach.cjs production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Environment configurations (to be updated after infrastructure is created)
const ENVIRONMENTS = {
  develop: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-d-outreach-server_develop',
    // Provided by operator (optional): exported by the deployment guide
    lambdaFunctionUrl: process.env.FUNCTION_URL || '',
    // SleepConnect CloudFront distribution ID (optional, used only for cache invalidation)
    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',
    // Outreach-specific CloudFront distribution (outreach-dev.mydreamconnect.com)
    outreachCloudfrontDistribution: 'E8BMOBRWCCCO2',
    s3AssetsBucket: 'sax-nextjs-us-east-1-develop-outreach-assets',
    region: 'us-east-1',
    memory: 1024,
    timeout: 30,
  },
  staging: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-s-outreach-server_staging',
    lambdaFunctionUrl: process.env.FUNCTION_URL || '',
    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',
    outreachCloudfrontDistribution: '', // TODO: Add staging Outreach CloudFront ID
    s3AssetsBucket: 'sax-nextjs-us-east-1-staging-outreach-assets',
    region: 'us-east-1',
    memory: 1024,
    timeout: 30,
  },
  production: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-p-outreach-server_production',
    lambdaFunctionUrl: process.env.FUNCTION_URL || '',
    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',
    outreachCloudfrontDistribution: '', // TODO: Add production Outreach CloudFront ID
    s3AssetsBucket: 'sax-nextjs-us-east-1-production-outreach-assets',
    region: 'us-east-1',
    memory: 2048,
    timeout: 30,
  },
};

// Parse command line arguments
const environment = process.argv[2] || 'develop';

if (!ENVIRONMENTS[environment]) {
  console.error(`❌ Invalid environment: ${environment}`);
  console.error(`   Valid options: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  process.exit(1);
}

const config = ENVIRONMENTS[environment];

// Validate required environment variables
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 Validating Environment Variables');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Core Auth0 variables (must match SleepConnect for shared sessions)
const requiredAuthVars = [
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
  'AUTH0_SECRET',
  'AUTH0_DOMAIN',
  'AUTH0_BASE_URL',
];

// Twilio variables (required for SMS functionality)
const requiredTwilioVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
];

// Multi-zone integration variables
const requiredMultiZoneVars = [
  'NEXT_PUBLIC_APP_BASE_URL',
  'NEXT_PUBLIC_SLEEPCONNECT_URL',
  'NEXT_PUBLIC_BASE_PATH',
];

// API Gateway variables
const requiredApiVars = [
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_WS_API_URL',
];

const allRequired = [
  ...requiredAuthVars,
  ...requiredTwilioVars,
  ...requiredMultiZoneVars,
  ...requiredApiVars,
];

const missing = allRequired.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('');
  console.error('❌ Missing required environment variables:');
  
  const missingAuth = missing.filter(v => requiredAuthVars.includes(v));
  const missingTwilio = missing.filter(v => requiredTwilioVars.includes(v));
  const missingMultiZone = missing.filter(v => requiredMultiZoneVars.includes(v));
  const missingApi = missing.filter(v => requiredApiVars.includes(v));
  
  if (missingAuth.length > 0) {
    console.error('');
    console.error('  Auth0 (must match SleepConnect):');
    missingAuth.forEach(v => console.error(`   - ${v}`));
  }
  if (missingTwilio.length > 0) {
    console.error('');
    console.error('  Twilio:');
    missingTwilio.forEach(v => console.error(`   - ${v}`));
  }
  if (missingMultiZone.length > 0) {
    console.error('');
    console.error('  Multi-zone integration:');
    missingMultiZone.forEach(v => console.error(`   - ${v}`));
  }
  if (missingApi.length > 0) {
    console.error('');
    console.error('  API Gateway:');
    missingApi.forEach(v => console.error(`   - ${v}`));
  }
  
  console.error('');
  console.error('Please set these in your .env.local file or as Lambda environment variables.');
  console.error('See ENVIRONMENT_VARIABLES.md for required values.');
  process.exit(1);
}

console.log('');
console.log('✅ All required environment variables present');
console.log('');
console.log('Multi-zone configuration:');
console.log(`   MULTI_ZONE_MODE:  true (hardcoded - Outreach always runs behind SleepConnect)`);
console.log(`   Base Path:        ${process.env.NEXT_PUBLIC_BASE_PATH}`);
console.log(`   SleepConnect URL: ${process.env.NEXT_PUBLIC_SLEEPCONNECT_URL}`);
console.log(`   Outreach URL:     ${process.env.NEXT_PUBLIC_APP_BASE_URL}`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Outreach SMS App Deployment (No SST)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📦 Environment:   ${environment}`);
console.log(`λ  Lambda:        ${config.lambdaFunction}`);
console.log(`☁️  CloudFront:    ${config.cloudfrontDistribution}`);
console.log(`🪣  S3 Assets:     ${config.s3AssetsBucket}`);
console.log(`📍 Region:        ${config.region}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Confirmation for production
if (environment === 'production') {
  console.log('⚠️  WARNING: Deploying to PRODUCTION');
  console.log('');
  console.log('   This will update the production Lambda function.');
  console.log('   Press Ctrl+C within 5 seconds to cancel...');
  console.log('');
  execSync('sleep 5', { stdio: 'inherit' });
}

const workspaceRoot = path.join(__dirname, '..');

try {
  // Step 1: Build with OpenNext (includes Next.js build internally)
  console.log('📦 Step 1: Building Next.js with OpenNext...');
  console.log('');

  // Filter out expected "Dynamic server usage" warnings from Next.js build
  // These are normal for API routes that use headers/cookies/searchParams
  const { spawnSync } = require('child_process');
  const buildResult = spawnSync('npx', ['@opennextjs/aws@3.6.6', 'build'], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=4096'
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024 // 50MB buffer
  });

  // Filter stdout - show everything
  if (buildResult.stdout) {
    process.stdout.write(buildResult.stdout);
  }

  // Filter stderr - remove noisy "Dynamic server usage" errors
  if (buildResult.stderr) {
    const filteredStderr = buildResult.stderr
      .split('\n')
      .filter(line => {
        // Skip dynamic server usage errors (these are expected for API routes)
        if (line.includes('DYNAMIC_SERVER_USAGE')) return false;
        if (line.includes("couldn't be rendered statically")) return false;
        if (line.includes('Dynamic server usage')) return false;
        if (line.match(/^\s+at\s+/)) return false; // Skip stack trace lines
        if (line.includes('[Proxy ')) return false;
        if (line.includes('[Set Cookie API]')) return false;
        if (line.includes('[Auth Profile Proxy]')) return false;
        if (line.includes('[AUTH] Error verifying JWT')) return false;
        if (line.includes('Forwarding to:')) return false;
        if (line.trim().startsWith('description:')) return false;
        if (line.trim().startsWith('digest:')) return false;
        if (line.trim() === '}') return false;
        return true;
      })
      .join('\n');
    if (filteredStderr.trim()) {
      process.stderr.write(filteredStderr);
    }
  }

  if (buildResult.status !== 0) {
    throw new Error(`OpenNext build failed with exit code ${buildResult.status}`);
  }
  console.log('');
  console.log('✅ Next.js build complete');
  console.log('');

  // Step 2: Fix pnpm symlinks for Next.js 14 (styled-jsx, @swc/helpers)
  console.log('🔧 Step 2: Fixing pnpm symlinks for Next.js 14...');
  console.log('');
  
  const nodeModulesPath = path.join(workspaceRoot, '.open-next/server-functions/default/node_modules');
  const pnpmPath = path.join(nodeModulesPath, '.pnpm');
  
  if (fs.existsSync(pnpmPath)) {
    // Fix styled-jsx symlink
    const pnpmDirs = fs.readdirSync(pnpmPath);
    const styledJsxDir = pnpmDirs.find(dir => dir.startsWith('styled-jsx@'));
    if (styledJsxDir && !fs.existsSync(path.join(nodeModulesPath, 'styled-jsx'))) {
      const source = path.join('.pnpm', styledJsxDir, 'node_modules', 'styled-jsx');
      fs.symlinkSync(source, path.join(nodeModulesPath, 'styled-jsx'), 'dir');
      console.log('   ✅ Created symlink: styled-jsx');
    }
    
    // Fix @swc/helpers symlink
    const swcHelpersDir = pnpmDirs.find(dir => dir.startsWith('@swc+helpers@'));
    if (swcHelpersDir) {
      const swcDir = path.join(nodeModulesPath, '@swc');
      if (!fs.existsSync(swcDir)) {
        fs.mkdirSync(swcDir, { recursive: true });
      }
      if (!fs.existsSync(path.join(swcDir, 'helpers'))) {
        const source = path.join('..', '.pnpm', swcHelpersDir, 'node_modules', '@swc', 'helpers');
        fs.symlinkSync(source, path.join(swcDir, 'helpers'), 'dir');
        console.log('   ✅ Created symlink: @swc/helpers');
      }
    }
    console.log('');
  }

  // Step 3: Zip the server function
  console.log('🗜️  Step 3: Creating deployment package...');
  const openNextDir = path.join(workspaceRoot, '.open-next');
  const serverDir = path.join(openNextDir, 'server-functions', 'default');
  const zipFile = path.join(openNextDir, 'function.zip');

  // Remove old zip if exists
  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }

  // Check if server directory exists
  if (!fs.existsSync(serverDir)) {
    console.error(`❌ Server directory not found: ${serverDir}`);
    console.error('   Available directories in .open-next:');
    if (fs.existsSync(openNextDir)) {
      execSync(`ls -la "${openNextDir}"`, { stdio: 'inherit' });
    }
    throw new Error('Server function directory not found');
  }

  console.log(`   Zipping from: ${serverDir}`);
  // Use -ry to preserve symlinks (required for styled-jsx and @swc/helpers)
  execSync(`cd "${serverDir}" && zip -ry "${zipFile}" . -q`, { stdio: 'inherit' });

  if (!fs.existsSync(zipFile)) {
    throw new Error(`Zip file was not created at: ${zipFile}`);
  }

  const zipStats = fs.statSync(zipFile);
  const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);
  console.log(`   Package size: ${zipSizeMB} MB`);
  console.log('✅ Deployment package created');
  console.log('');

  // Step 4: Update Lambda function
  console.log('☁️  Step 4: Updating Lambda function...');
  console.log(`   Function: ${config.lambdaFunction}`);
  console.log('');

  // Use --no-cli-pager to prevent AWS CLI from opening vi/less with JSON output
  execSync(
    `aws lambda update-function-code \
      --function-name "${config.lambdaFunction}" \
      --zip-file fileb://"${zipFile}" \
      --region ${config.region} \
      --no-cli-pager`,
    { stdio: 'inherit' }
  );

  console.log('');
  console.log('✅ Lambda function code updated');
  console.log('');

  // Step 5: Wait for Lambda to be ready
  console.log('⏳ Step 5: Waiting for Lambda update to complete...');
  execSync(
    `aws lambda wait function-updated \
      --function-name "${config.lambdaFunction}" \
      --region ${config.region}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Lambda function is ready');
  console.log('');

  // Step 5.5: Update environment variables
  console.log('🔧 Step 5.5: Updating environment variables...');
  
  const envVars = {
    NODE_ENV: 'production',
    ENVIRONMENT: environment,
    MULTI_ZONE_MODE: 'true',
    NEXT_PUBLIC_BASE_PATH: '/outreach',
    NEXT_PUBLIC_APP_BASE_URL: environment === 'production'
      ? 'https://dreamconnect.health'
      : `https://${environment === 'develop' ? 'dev' : 'staging'}.mydreamconnect.com`,
    // Add other necessary runtime variables from process.env if available
    AUTH0_SECRET: process.env.AUTH0_SECRET || process.env.AUTH0_CLIENT_SECRET,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_ISSUER_BASE_URL: process.env.AUTH0_ISSUER_BASE_URL || (process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}` : undefined),
    AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
    AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
    API_BASE_URL: process.env.API_BASE_URL,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
    NEXT_PUBLIC_WS_API_URL: process.env.WS_API_URL,
    
    // Application
    LOG_LEVEL: process.env.LOG_LEVEL,
    SAX_COMPANY: process.env.SAX_COMPANY,
    SST_STAGE: process.env.SST_STAGE,
    
    // Auth0 Management API (M2M)
    AUTH0_M2M_DOMAIN: process.env.AUTH0_M2M_DOMAIN,
    AUTH0_M2M_CLIENT_ID: process.env.AUTH0_M2M_CLIENT_ID,
    AUTH0_M2M_CLIENT_SECRET: process.env.AUTH0_M2M_CLIENT_SECRET,
    
    // AWS Configuration
    // Note: AWS_REGION is automatically set by Lambda and cannot be overridden
    SES_REGION: process.env.SES_REGION,
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
    CLOUDWATCH_EMAIL_LOG_GROUP: process.env.CLOUDWATCH_EMAIL_LOG_GROUP,
    CLOUDWATCH_EMAIL_LOG_STREAM: process.env.CLOUDWATCH_EMAIL_LOG_STREAM,
    
    // S3 Configuration
    S3_CHART_UPLOADS_BUCKET: process.env.S3_CHART_UPLOADS_BUCKET,
    S3_CHART_UPLOADS_PREFIX: process.env.S3_CHART_UPLOADS_PREFIX,
    S3_CHART_UPLOADS_KMS_KEY_ARN: process.env.S3_CHART_UPLOADS_KMS_KEY_ARN,
    MAX_SINGLE_PART_BYTES: process.env.MAX_SINGLE_PART_BYTES,
    
    // DynamoDB Configuration
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
    AUTH_DYNAMODB_REGION: process.env.AUTH_DYNAMODB_REGION,
    
    // PostgreSQL Database (RDS)
    HOST: process.env.HOST,
    PG_DB: process.env.PG_DB,
    SECRET_ARN: process.env.SECRET_ARN,
    
    // Twilio From Number
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    
    // Lex Bot Configuration
    LEX_BOT_ID: process.env.LEX_BOT_ID,
    LEX_BOT_ALIAS_ID: process.env.LEX_BOT_ALIAS_ID,
    NEXT_PUBLIC_AI_OR_LEX: process.env.NEXT_PUBLIC_AI_OR_LEX,
    
    // UI Configuration
    NEXT_PUBLIC_BANNER_LOGO: process.env.NEXT_PUBLIC_BANNER_LOGO,
    NEXT_PUBLIC_BANNER_LINK: process.env.NEXT_PUBLIC_BANNER_LINK,
    NEXT_PUBLIC_BANNER_TEXT: process.env.NEXT_PUBLIC_BANNER_TEXT,
    NEXT_PUBLIC_SHOW_BANNER: process.env.NEXT_PUBLIC_SHOW_BANNER,
    
    // JWT Configuration
    TOKEN_EXPIRY: process.env.TOKEN_EXPIRY,
    
    // Zoho Configuration
    ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI,
    ZOHO_SERVICE_ID: process.env.ZOHO_SERVICE_ID,
    ZOHO_WORKSPACE_ID: process.env.ZOHO_WORKSPACE_ID,
    ZOHO_STAFF_ID: process.env.ZOHO_STAFF_ID,
    ZOHO_STAFF_EMAIL: process.env.ZOHO_STAFF_EMAIL,
    
    // URLs from .env
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_EXTERNAL_FORM_URL: process.env.NEXT_PUBLIC_EXTERNAL_FORM_URL,
    NEXT_SMS_URL: process.env.NEXT_SMS_URL,
    FORMS_BASE_URL: process.env.FORMS_BASE_URL,
  };

  // Filter out undefined values
  Object.keys(envVars).forEach(key => envVars[key] === undefined && delete envVars[key]);

  try {
    // Get current environment variables first to avoid overwriting others
    const currentConfig = JSON.parse(execSync(
      `aws lambda get-function-configuration \
        --function-name "${config.lambdaFunction}" \
        --region ${config.region} \
        --output json`,
      { encoding: 'utf8' }
    ));

    const variables = {
      ...(currentConfig.Environment?.Variables || {}),
      ...envVars
    };

    // Use a temp JSON file to avoid shell escaping issues with complex JSON
    const tempConfigPath = path.join(os.tmpdir(), `lambda-env-${Date.now()}.json`);
    const lambdaEnvConfig = {
      FunctionName: config.lambdaFunction,
      Environment: { Variables: variables }
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(lambdaEnvConfig));

    execSync(
      `aws lambda update-function-configuration \
        --cli-input-json file://${tempConfigPath} \
        --region ${config.region}`,
      { stdio: 'inherit' }
    );

    // Clean up temp file
    fs.unlinkSync(tempConfigPath);
    
    console.log('✅ Environment variables updated');
    console.log('');
    
    // Wait for update to complete
    execSync(
      `aws lambda wait function-updated \
        --function-name "${config.lambdaFunction}" \
        --region ${config.region}`,
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.log(`⚠️  Warning: Could not update environment variables: ${error.message}`);
  }

  // Step 5.6: Configure CloudFront cache policy for RSC support
  // Next.js 14+ uses React Server Components (RSC) which require specific headers
  // in the cache key to prevent caching empty prefetch responses
  if (config.outreachCloudfrontDistribution) {
    console.log('🔧 Step 5.6: Configuring CloudFront cache policy for RSC...');
    console.log(`   Distribution: ${config.outreachCloudfrontDistribution}`);

    try {
      const cachePolicyName = `OutreachRSCCachePolicy_${config.env}`;
      let cachePolicyId = null;

      // Check if RSC-aware cache policy already exists
      console.log('   🔍 Checking for existing RSC cache policy...');
      const listPoliciesOutput = execSync(
        'aws cloudfront list-cache-policies --type custom --output json',
        { encoding: 'utf8' }
      );
      const policies = JSON.parse(listPoliciesOutput);
      const existingPolicy = policies.CachePolicyList?.Items?.find(
        item => item.CachePolicy.CachePolicyConfig.Name === cachePolicyName
      );

      if (existingPolicy) {
        cachePolicyId = existingPolicy.CachePolicy.Id;
        console.log(`   ✅ Found existing cache policy: ${cachePolicyId}`);
      } else {
        // Create new RSC-aware cache policy
        console.log('   🆕 Creating new RSC-aware cache policy...');
        const cachePolicyConfig = {
          Name: cachePolicyName,
          Comment: 'Cache policy for Outreach Next.js app with RSC header support to prevent caching empty prefetch responses',
          DefaultTTL: 86400,
          MaxTTL: 31536000,
          MinTTL: 0,
          ParametersInCacheKeyAndForwardedToOrigin: {
            EnableAcceptEncodingGzip: true,
            EnableAcceptEncodingBrotli: true,
            CookiesConfig: {
              CookieBehavior: 'all'
            },
            HeadersConfig: {
              HeaderBehavior: 'whitelist',
              Headers: {
                Quantity: 5,
                Items: [
                  'RSC',
                  'Next-Router-Prefetch',
                  'Next-Router-State-Tree',
                  'Next-URL',
                  'x-middleware-prefetch'
                ]
              }
            },
            QueryStringsConfig: {
              QueryStringBehavior: 'whitelist',
              QueryStrings: {
                Quantity: 1,
                Items: ['rsc']
              }
            }
          }
        };

        const tempPolicyPath = path.join(os.tmpdir(), `cache-policy-${Date.now()}.json`);
        fs.writeFileSync(tempPolicyPath, JSON.stringify(cachePolicyConfig));

        const createPolicyOutput = execSync(
          `aws cloudfront create-cache-policy --cache-policy-config file://${tempPolicyPath} --output json`,
          { encoding: 'utf8' }
        );
        const createdPolicy = JSON.parse(createPolicyOutput);
        cachePolicyId = createdPolicy.CachePolicy.Id;

        fs.unlinkSync(tempPolicyPath);
        console.log(`   ✅ Created cache policy: ${cachePolicyId}`);
      }

      // Get current distribution config
      console.log('   🔍 Checking distribution cache behavior...');
      const cfConfigOutput = execSync(
        `aws cloudfront get-distribution-config \
          --id ${config.outreachCloudfrontDistribution} \
          --output json`,
        { encoding: 'utf8' }
      );
      const cfConfig = JSON.parse(cfConfigOutput);
      const etag = cfConfig.ETag;
      const distConfig = cfConfig.DistributionConfig;

      // Check if distribution is using legacy ForwardedValues or already has correct cache policy
      const currentCacheBehavior = distConfig.DefaultCacheBehavior;
      const needsUpdate = currentCacheBehavior.ForwardedValues || 
                         currentCacheBehavior.CachePolicyId !== cachePolicyId;

      if (needsUpdate) {
        console.log('   🔧 Updating distribution to use RSC-aware cache policy...');

        // Replace legacy ForwardedValues with modern cache policy + origin request policy
        delete currentCacheBehavior.ForwardedValues;
        delete currentCacheBehavior.MinTTL;
        delete currentCacheBehavior.DefaultTTL;
        delete currentCacheBehavior.MaxTTL;
        
        currentCacheBehavior.CachePolicyId = cachePolicyId;
        currentCacheBehavior.OriginRequestPolicyId = 'b689b0a8-53d0-40ab-baf2-68738e2966ac'; // AllViewerExceptHostHeader

        // Write updated config to temp file
        const tempCfConfigPath = path.join(os.tmpdir(), `cf-config-${Date.now()}.json`);
        fs.writeFileSync(tempCfConfigPath, JSON.stringify(distConfig));

        execSync(
          `aws cloudfront update-distribution \
            --id ${config.outreachCloudfrontDistribution} \
            --if-match ${etag} \
            --distribution-config file://${tempCfConfigPath}`,
          { stdio: 'inherit' }
        );

        fs.unlinkSync(tempCfConfigPath);
        console.log('   ✅ CloudFront distribution updated with RSC cache policy');
        console.log('   ⏳ Note: CloudFront changes may take a few minutes to propagate');
      } else {
        console.log('   ✅ CloudFront already using correct RSC cache policy');
      }
      console.log('');
    } catch (error) {
      console.log(`   ⚠️  Warning: Could not configure CloudFront cache policy: ${error.message}`);
      console.log('');
    }
  }

  // Step 6: Deploy static assets to S3
  const assetsDir = path.join(openNextDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    console.log('📤 Step 6: Uploading static assets to S3...');
    console.log(`   Bucket: ${config.s3AssetsBucket}`);
    console.log('');

    try {
      // Upload _next directory with long cache (1 year - immutable)
      const nextDir = path.join(assetsDir, '_next');
      if (fs.existsSync(nextDir)) {
        console.log('   Uploading _next/* (immutable, 1 year cache)...');
        execSync(
          `aws s3 sync "${nextDir}" s3://${config.s3AssetsBucket}/outreach-static/_next \
            --delete \
            --cache-control "public,max-age=31536000,immutable" \
            --region ${config.region}`,
          { stdio: 'inherit' }
        );
      }

      // Upload root-level files (favicons, manifest, etc.) - 1 day cache
      console.log('   Uploading root files (1 day cache)...');
      const rootFiles = fs.readdirSync(assetsDir).filter(f =>
        fs.statSync(path.join(assetsDir, f)).isFile()
      );

      for (const file of rootFiles) {
        execSync(
          `aws s3 cp "${path.join(assetsDir, file)}" \
            s3://${config.s3AssetsBucket}/outreach-static/${file} \
            --cache-control "public,max-age=86400" \
            --region ${config.region}`,
          { stdio: 'inherit' }
        );
      }

      // Upload subdirectories (images, etc.) - 1 day cache
      const rootDirs = fs.readdirSync(assetsDir).filter(f =>
        fs.statSync(path.join(assetsDir, f)).isDirectory() && f !== '_next'
      );

      for (const dir of rootDirs) {
        console.log(`   Uploading ${dir}/* (1 day cache)...`);
        execSync(
          `aws s3 sync "${path.join(assetsDir, dir)}" \
            s3://${config.s3AssetsBucket}/outreach-static/${dir} \
            --cache-control "public,max-age=86400" \
            --region ${config.region}`,
          { stdio: 'inherit' }
        );
      }

      console.log('');
      console.log('✅ Static assets uploaded');
      console.log('');
    } catch (error) {
      console.log('⚠️  Warning: Could not upload assets to S3');
      console.log('   Assets will be served from Lambda (slower but functional)');
      console.log('');
    }
  } else {
    console.log('ℹ️  Step 6: No static assets to upload');
    console.log('');
  }

  // Step 7: Invalidate CloudFront cache (optional)
  const hasCloudFrontDistribution =
    Boolean(config.cloudfrontDistribution) &&
    !String(config.cloudfrontDistribution).includes('[UPDATE-AFTER-CREATION]');

  if (hasCloudFrontDistribution) {
    console.log('🔄 Step 7: Invalidating CloudFront cache...');
    console.log(`   Distribution: ${config.cloudfrontDistribution}`);
    console.log('');

    try {
      const invalidationResult = execSync(
        `aws cloudfront create-invalidation \
          --distribution-id ${config.cloudfrontDistribution} \
          --paths "/outreach/*" "/outreach-static/*" \
          --region ${config.region} \
          --output json`,
        { encoding: 'utf8' }
      );

      const invalidation = JSON.parse(invalidationResult);
      console.log(`   Invalidation ID: ${invalidation.Invalidation.Id}`);
      console.log('✅ CloudFront cache invalidation started');
      console.log('');
    } catch (error) {
      console.log('⚠️  Warning: Could not invalidate CloudFront cache');
      console.log('   Users may see cached content until TTL expires');
      console.log('');
    }
  } else {
    console.log('ℹ️  Step 7: Skipping CloudFront invalidation');
    console.log('   Reason: cloudfrontDistribution is not configured');
    console.log('');
  }

  // Success summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Deployment Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`🌍 Environment:     ${environment}`);
  console.log(`λ  Lambda:          ${config.lambdaFunction}`);
  console.log(`🔗 Function URL:    ${config.lambdaFunctionUrl}`);
  console.log(`☁️  CloudFront:      ${config.cloudfrontDistribution}`);
  console.log('');
  console.log('🌐 Multi-zone URL:');
  if (environment === 'develop') {
    console.log('   https://dev.mydreamconnect.com/outreach');
  } else if (environment === 'staging') {
    console.log('   https://staging.mydreamconnect.com/outreach');
  } else {
    console.log('   https://dreamconnect.health/outreach');
  }
  console.log('');
  console.log('📊 View logs:');
  console.log(`   aws logs tail /aws/lambda/${config.lambdaFunction} --follow`);
  console.log('');
  console.log('🔍 Check function:');
  console.log(`   aws lambda get-function --function-name ${config.lambdaFunction}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Cleanup
  console.log('🧹 Cleaning up...');
  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }
  console.log('✅ Cleanup complete');
  console.log('');

} catch (error) {
  console.error('');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('❌ Deployment Failed');
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('');
  console.error(error.message);
  console.error('');
  process.exit(1);
}
