#!/usr/bin/env node
/**
 * Deploy Existing Outreach Build (Skip Build Step)
 * 
 * Deploys an existing .open-next build to AWS Lambda without rebuilding.
 * Use this when you already have a successful build and just need to deploy.
 * 
 * Usage:
 *   node scripts/deploy-outreach-only.cjs [environment]
 * 
 * Examples:
 *   node scripts/deploy-outreach-only.cjs develop
 *   node scripts/deploy-outreach-only.cjs staging
 *   node scripts/deploy-outreach-only.cjs production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Environment configurations
const ENVIRONMENTS = {
  develop: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-d-outreach-server_develop',
    s3AssetsBucket: 'sax-nextjs-us-east-1-develop-outreach-assets',
    region: 'us-east-1',
  },
  staging: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-s-outreach-server_staging',
    s3AssetsBucket: 'sax-nextjs-us-east-1-staging-outreach-assets',
    region: 'us-east-1',
  },
  production: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-p-outreach-server_production',
    s3AssetsBucket: 'sax-nextjs-us-east-1-production-outreach-assets',
    region: 'us-east-1',
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
const workspaceRoot = path.join(__dirname, '..');

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Deploy Existing Build (Skip Rebuild)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📦 Environment:   ${environment}`);
console.log(`λ  Lambda:        ${config.lambdaFunction}`);
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

try {
  // Step 0: Verify .open-next build exists
  console.log('🔍 Step 0: Checking for existing build...');
  const openNextDir = path.join(workspaceRoot, '.open-next');
  const serverDir = path.join(openNextDir, 'server-functions', 'default');
  
  if (!fs.existsSync(serverDir)) {
    console.error('');
    console.error('❌ No existing build found!');
    console.error('   Run: npm run build:open-next');
    console.error('   Or: node scripts/deploy-outreach.cjs develop');
    console.error('');
    process.exit(1);
  }
  
  // Check build age
  const buildStats = fs.statSync(serverDir);
  const buildAge = Date.now() - buildStats.mtimeMs;
  const buildAgeMinutes = Math.floor(buildAge / 60000);
  
  console.log(`   Build found: ${buildAgeMinutes} minutes old`);
  console.log('✅ Existing build verified');
  console.log('');

  // Step 1: Create deployment package
  console.log('🗜️  Step 1: Creating deployment package...');
  const zipFile = path.join(openNextDir, 'function.zip');

  // Remove old zip if exists
  if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
  }

  console.log(`   Zipping from: ${serverDir}`);
  execSync(`cd "${serverDir}" && zip -r "${zipFile}" . -q`, { stdio: 'inherit' });

  if (!fs.existsSync(zipFile)) {
    throw new Error(`Zip file was not created at: ${zipFile}`);
  }

  const zipStats = fs.statSync(zipFile);
  const zipSizeMB = (zipStats.size / 1024 / 1024).toFixed(2);
  console.log(`   Package size: ${zipSizeMB} MB`);
  console.log('✅ Deployment package created');
  console.log('');

  // Step 2: Update Lambda function
  console.log('☁️  Step 2: Updating Lambda function...');
  console.log(`   Function: ${config.lambdaFunction}`);
  console.log('');

  execSync(
    `aws lambda update-function-code \
      --function-name "${config.lambdaFunction}" \
      --zip-file fileb://"${zipFile}" \
      --region ${config.region} \
      --no-cli-pager \
      --query 'FunctionName' \
      --output text`,
    { stdio: 'inherit', env: { ...process.env, AWS_PAGER: '' } }
  );

  console.log('');
  console.log('✅ Lambda function code updated');
  console.log('');

  // Step 3: Wait for Lambda to be ready
  console.log('⏳ Step 3: Waiting for Lambda update to complete...');
  execSync(
    `aws lambda wait function-updated \
      --function-name "${config.lambdaFunction}" \
      --region ${config.region}`,
    { stdio: 'inherit', env: { ...process.env, AWS_PAGER: '' } }
  );
  console.log('✅ Lambda function is ready');
  console.log('');

  // Step 4: Deploy static assets to S3
  const assetsDir = path.join(openNextDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    console.log('📤 Step 4: Uploading static assets to S3...');
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
            --region ${config.region} \
            --no-cli-pager`,
          { stdio: 'inherit', env: { ...process.env, AWS_PAGER: '' } }
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
            --region ${config.region} \
            --no-cli-pager`,
          { stdio: 'inherit', env: { ...process.env, AWS_PAGER: '' } }
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
            --region ${config.region} \
            --no-cli-pager`,
          { stdio: 'inherit', env: { ...process.env, AWS_PAGER: '' } }
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
    console.log('ℹ️  Step 4: No static assets to upload');
    console.log('');
  }

  // Success summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Deployment Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`🌍 Environment:     ${environment}`);
  console.log(`λ  Lambda:          ${config.lambdaFunction}`);
  console.log('');
  console.log('🌐 Application URL:');
  if (environment === 'develop') {
    console.log('   https://dev.mydreamconnect.com/outreach');
  } else if (environment === 'staging') {
    console.log('   https://staging.mydreamconnect.com/outreach');
  } else {
    console.log('   https://dreamconnect.health/outreach');
  }
  console.log('');
  console.log('📊 View logs:');
  console.log(`   aws logs tail /aws/lambda/${config.lambdaFunction} --follow --no-cli-pager`);
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
