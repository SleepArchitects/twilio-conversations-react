#!/usr/bin/env node
/**
 * Outreach SMS App Deployment
 * Deploys Outreach Next.js app to AWS Lambda using OpenNext + AWS SDK
 * 
 * Usage:
 *   node scripts/deploy-outreach.cjs [environment] [--skip-build]
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');
const { 
  LambdaClient, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, 
  PublishVersionCommand, UpdateAliasCommand, TagResourceCommand, GetFunctionCommand,
  CreateFunctionCommand, CreateAliasCommand
} = require('@aws-sdk/client-lambda');
const { 
  CloudFrontClient, CreateInvalidationCommand, ListDistributionsCommand
} = require('@aws-sdk/client-cloudfront');
const { 
  IAMClient, GetRoleCommand 
} = require('@aws-sdk/client-iam');
const { getResourceNames } = require('./aws-config');

const REGION = 'us-east-1';
const lambda = new LambdaClient({ region: REGION });
const cloudfront = new CloudFrontClient({ region: REGION });
const iam = new IAMClient({ region: REGION });

// Parse args
const args = process.argv.slice(2);
const environment = args.find(a => !a.startsWith('--')) || 'develop';
const skipBuild = args.includes('--skip-build');

// 1. Load Environment Variables (Coalescing)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🚀 Deploying to [${environment}]`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Load .env (base)
dotenv.config({ path: '.env' });
// Load .env.local (overrides)
if (fs.existsSync('.env.local')) {
  console.log('Tb Loading .env.local overrides');
  const envLocal = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envLocal) {
    process.env[k] = envLocal[k];
  }
}

// Get resource names for this environment
let resources;
try {
  resources = getResourceNames(environment);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}

// 2. Validate Infrastructure
console.log('\n🔍 Checking infrastructure...');
try {
  const checkResult = execSync(`node scripts/check-infrastructure.cjs ${environment}`, { encoding: 'utf8' });
  const match = checkResult.match(/JSON_OUTPUT=(.*)/);
  if (match) {
    const status = JSON.parse(match[1]);
    if (!status.ready) {
      console.warn('⚠️  Infrastructure check reported issues. Attempting deployment anyway (Lambda creation might be needed)...');
      console.warn('   Missing:', status.missing.join(', '));
    }
  } else {
    console.warn('⚠️ Could not parse infrastructure check output. Proceeding with caution...');
  }
} catch (e) {
  console.error('❌ Infrastructure check failed');
  process.exit(1);
}

// 3. Validate Required Env Vars
const requiredVars = [
  'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_SECRET', 'AUTH0_DOMAIN', 'AUTH0_BASE_URL',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
  'NEXT_PUBLIC_APP_BASE_URL', 'NEXT_PUBLIC_SLEEPCONNECT_URL', 'NEXT_PUBLIC_BASE_PATH'
];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// 4. Build
const workspaceRoot = path.join(__dirname, '..');
if (!skipBuild) {
  console.log('\n📦 Building with OpenNext...');
  const buildResult = spawnSync('npx', ['@opennextjs/aws@3.6.6', 'build'], {
    cwd: workspaceRoot,
    env: { ...process.env, NODE_ENV: 'production', NODE_OPTIONS: '--max-old-space-size=4096' },
    stdio: 'inherit'
  });
  if (buildResult.status !== 0) throw new Error('Build failed');

  // Fix pnpm symlinks
  const nodeModulesPath = path.join(workspaceRoot, '.open-next/server-functions/default/node_modules');
  if (fs.existsSync(path.join(nodeModulesPath, '.pnpm'))) {
     const pnpmDirs = fs.readdirSync(path.join(nodeModulesPath, '.pnpm'));
     const styledJsx = pnpmDirs.find(d => d.startsWith('styled-jsx@'));
     if (styledJsx && !fs.existsSync(path.join(nodeModulesPath, 'styled-jsx'))) {
        fs.symlinkSync(path.join('.pnpm', styledJsx, 'node_modules', 'styled-jsx'), path.join(nodeModulesPath, 'styled-jsx'), 'dir');
     }
  }
}

// 5. Zip
console.log('\n🗜️  Zipping function...');
const openNextDir = path.join(workspaceRoot, '.open-next');
const zipFile = path.join(openNextDir, 'function.zip');
execSync(`cd "${path.join(openNextDir, 'server-functions/default')}" && zip -ry "${zipFile}" . -q`, { stdio: 'inherit' });

// 6. Deploy Lambda
(async () => {
  try {
    console.log(`\n☁️  Deploying Lambda: ${resources.lambdaName}`);
    
    // Check if function exists
    let exists = false;
    try {
      await lambda.send(new GetFunctionCommand({ FunctionName: resources.lambdaName }));
      exists = true;
    } catch (e) {
      if (e.name !== 'ResourceNotFoundException') throw e;
    }

    const lambdaEnvVars = {
      NODE_ENV: 'production',
      ENVIRONMENT: environment,
      MULTI_ZONE_MODE: 'true',
      NEXT_PUBLIC_BASE_PATH: '/outreach',
      ...requiredVars.reduce((acc, k) => ({ ...acc, [k]: process.env[k] }), {})
    };

    if (exists) {
      console.log('   Function exists. Updating code...');
      await lambda.send(new UpdateFunctionCodeCommand({
        FunctionName: resources.lambdaName,
        ZipFile: fs.readFileSync(zipFile)
      }));

      // Wait for update
      let ready = false;
      while(!ready) {
        await new Promise(r => setTimeout(r, 2000));
        const fn = await lambda.send(new GetFunctionCommand({ FunctionName: resources.lambdaName }));
        if (fn.Configuration.LastUpdateStatus === 'Successful') ready = true;
        if (fn.Configuration.LastUpdateStatus === 'Failed') throw new Error('Lambda update failed');
      }

      console.log('   Updating configuration...');
      await lambda.send(new UpdateFunctionConfigurationCommand({
        FunctionName: resources.lambdaName,
        Environment: { Variables: lambdaEnvVars }
      }));
    } else {
      console.log('   Function does not exist. Creating...');
      
      // Get Role ARN
      console.log(`   Looking up role: ${resources.roleName}`);
      const role = await iam.send(new GetRoleCommand({ RoleName: resources.roleName }));
      const roleArn = role.Role.Arn;

      await lambda.send(new CreateFunctionCommand({
        FunctionName: resources.lambdaName,
        Runtime: 'nodejs20.x',
        Role: roleArn,
        Handler: 'index.handler', // OpenNext default
        Code: { ZipFile: fs.readFileSync(zipFile) },
        Environment: { Variables: lambdaEnvVars },
        Timeout: 30,
        MemorySize: environment === 'production' ? 2048 : 1024,
        Architectures: ['x86_64'],
        Tags: resources.tags
      }));
      console.log('   Function created.');
    }
    
    // Wait for stability
    await new Promise(r => setTimeout(r, 5000));

    // Publish Version
    console.log('   Publishing version...');
    const version = await lambda.send(new PublishVersionCommand({
      FunctionName: resources.lambdaName,
      Description: `Deploy ${new Date().toISOString()}`
    }));
    console.log(`   🚀 Published v${version.Version}`);

    // Tag Resource
    const gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    await lambda.send(new TagResourceCommand({
      Resource: version.FunctionArn,
      Tags: {
        'GitCommit': gitHash,
        'Deployer': process.env.USER || 'ci'
      }
    }));

    // Update Alias
    console.log('   Updating "live" alias...');
    try {
      await lambda.send(new UpdateAliasCommand({
        FunctionName: resources.lambdaName,
        Name: 'live',
        FunctionVersion: version.Version
      }));
    } catch (e) {
      if (e.name === 'ResourceNotFoundException') {
         await lambda.send(new CreateAliasCommand({
            FunctionName: resources.lambdaName,
            Name: 'live',
            FunctionVersion: version.Version
         }));
         console.log('   Alias "live" created.');
      } else throw e;
    }

    // 7. S3 Sync (Assets) - NO DELETE
    console.log(`\n📤 Uploading assets to ${resources.bucketName}...`);
    const assetsDir = path.join(openNextDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      execSync(`aws s3 sync "${path.join(assetsDir, '_next')}" s3://${resources.bucketName}/outreach-static/_next --cache-control "public,max-age=31536000,immutable"`, { stdio: 'inherit' });
      execSync(`aws s3 sync "${assetsDir}" s3://${resources.bucketName}/outreach-static/ --exclude "_next/*" --cache-control "public,max-age=86400"`, { stdio: 'inherit' });
    }

    // 8. Invalidate CloudFront
    console.log('\n🔄 Invalidating CloudFront...');
    let distributionId = null;
    let found = false;
    let marker = undefined;
    
    // Attempt to find distribution by Alias
    do {
      const response = await cloudfront.send(new ListDistributionsCommand({ Marker: marker }));
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
      await cloudfront.send(new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `deploy-${Date.now()}`,
          Paths: {
            Quantity: 1,
            Items: ['/*'] 
          }
        }
      }));
      console.log('   ✅ Invalidation requested');
    } else {
      console.warn('⚠️  Could not find CloudFront distribution for invalidation');
      console.warn(`   Looked for alias: ${resources.domainName}`);
    }

    console.log('\n✅ Deployment Complete!');
    console.log(`🌍 URL: https://${resources.domainName}/outreach`);

  } catch (e) {
    console.error('\n❌ Deployment Failed:', e);
    process.exit(1);
  }
})();
