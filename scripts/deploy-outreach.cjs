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

// Environment configurations (to be updated after infrastructure is created)
const ENVIRONMENTS = {
  develop: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-d-outreach-server_develop',
    // Provided by operator (optional): exported by the deployment guide
    lambdaFunctionUrl: process.env.FUNCTION_URL || '',
    // SleepConnect CloudFront distribution ID (optional, used only for cache invalidation)
    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',
    s3AssetsBucket: 'sax-nextjs-us-east-1-develop-outreach-assets',
    region: 'us-east-1',
    memory: 1024,
    timeout: 30,
  },
  staging: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-s-outreach-server_staging',
    lambdaFunctionUrl: process.env.FUNCTION_URL || '',
    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',
    s3AssetsBucket: 'sax-nextjs-us-east-1-staging-outreach-assets',
    region: 'us-east-1',
    memory: 1024,
    timeout: 30,
  },
  production: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-p-outreach-server_production',
    lambdaFunctionUrl: process.env.FUNCTION_URL || '',
    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',
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
