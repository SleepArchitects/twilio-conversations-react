#!/usr/bin/env node
/**
 * Fix CloudFront Compression for Outreach Distributions
 * 
 * Updates CloudFront distributions to use a cache policy with compression enabled.
 * This prevents Lambda payload size errors (>6MB) for large responses.
 * 
 * Usage:
 *   node scripts/fix-cloudfront-compression.cjs [environment]
 * 
 * Examples:
 *   node scripts/fix-cloudfront-compression.cjs staging
 *   node scripts/fix-cloudfront-compression.cjs production
 * 
 * References:
 *   - docs/DEPLOYMENT_RUNBOOK.md (section on CloudFront compression)
 *   - AWS CloudFront Cache Policy documentation
 */

const {
  CloudFrontClient,
  ListDistributionsCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  GetCachePolicyCommand,
} = require('@aws-sdk/client-cloudfront');

const REGION = 'us-east-1';
const cloudfront = new CloudFrontClient({ region: REGION });

// Environment to domain mapping
const ENVIRONMENTS = {
  develop: 'dev.mydreamconnect.com',
  staging: 'outreach-stage.mydreamconnect.com',
  production: 'dreamconnect.health',
};

// Cache policy with compression enabled (from develop environment)
const COMPRESSION_ENABLED_CACHE_POLICY = '8cf06b49-7e76-4f08-8f04-ebb260198307';

// Parse command line arguments
const environment = process.argv[2] || 'staging';

if (!ENVIRONMENTS[environment]) {
  console.error(`❌ Invalid environment: ${environment}`);
  console.error(`   Valid options: ${Object.keys(ENVIRONMENTS).join(', ')}`);
  process.exit(1);
}

const domainName = ENVIRONMENTS[environment];

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 Fix CloudFront Compression');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Environment:  ${environment}`);
console.log(`🌐 Domain:       ${domainName}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

(async () => {
  try {
    // Step 1: Find the CloudFront distribution
    console.log('🔍 Step 1: Finding CloudFront distribution...');
    let distributionId = null;
    let marker = undefined;

    do {
      const response = await cloudfront.send(
        new ListDistributionsCommand({ Marker: marker })
      );

      if (response.DistributionList?.Items) {
        for (const dist of response.DistributionList.Items) {
          if (dist.Aliases?.Items?.includes(domainName)) {
            distributionId = dist.Id;
            break;
          }
        }
      }

      marker = response.DistributionList?.NextMarker;
    } while (marker && !distributionId);

    if (!distributionId) {
      console.error(`❌ Could not find CloudFront distribution for ${domainName}`);
      process.exit(1);
    }

    console.log(`   Found Distribution: ${distributionId}`);
    console.log('');

    // Step 2: Get current distribution configuration
    console.log('📋 Step 2: Getting current configuration...');
    const distConfigResponse = await cloudfront.send(
      new GetDistributionConfigCommand({ Id: distributionId })
    );

    const distConfig = distConfigResponse.DistributionConfig;
    const etag = distConfigResponse.ETag;
    const currentCachePolicyId = distConfig.DefaultCacheBehavior.CachePolicyId;

    console.log(`   Current Cache Policy: ${currentCachePolicyId}`);

    // Step 3: Check current cache policy compression settings
    console.log('');
    console.log('🔍 Step 3: Checking compression settings...');
    const currentCachePolicy = await cloudfront.send(
      new GetCachePolicyCommand({ Id: currentCachePolicyId })
    );

    const gzipEnabled =
      currentCachePolicy.CachePolicy?.CachePolicyConfig
        ?.ParametersInCacheKeyAndForwardedToOrigin?.EnableAcceptEncodingGzip;
    const brotliEnabled =
      currentCachePolicy.CachePolicy?.CachePolicyConfig
        ?.ParametersInCacheKeyAndForwardedToOrigin?.EnableAcceptEncodingBrotli;
    const policyName = currentCachePolicy.CachePolicy?.CachePolicyConfig?.Name;

    console.log(`   Policy Name: ${policyName}`);
    console.log(`   Gzip Enabled: ${gzipEnabled}`);
    console.log(`   Brotli Enabled: ${brotliEnabled}`);

    if (gzipEnabled && brotliEnabled) {
      console.log('');
      console.log('✅ Compression is already enabled!');
      console.log('   No changes needed.');
      console.log('');
      return;
    }

    // Step 4: Verify the target cache policy has compression
    console.log('');
    console.log('🔍 Step 4: Verifying target cache policy...');
    const targetCachePolicy = await cloudfront.send(
      new GetCachePolicyCommand({ Id: COMPRESSION_ENABLED_CACHE_POLICY })
    );

    const targetGzip =
      targetCachePolicy.CachePolicy?.CachePolicyConfig
        ?.ParametersInCacheKeyAndForwardedToOrigin?.EnableAcceptEncodingGzip;
    const targetBrotli =
      targetCachePolicy.CachePolicy?.CachePolicyConfig
        ?.ParametersInCacheKeyAndForwardedToOrigin?.EnableAcceptEncodingBrotli;
    const targetName = targetCachePolicy.CachePolicy?.CachePolicyConfig?.Name;

    console.log(`   Target Policy: ${targetName} (${COMPRESSION_ENABLED_CACHE_POLICY})`);
    console.log(`   Gzip: ${targetGzip}, Brotli: ${targetBrotli}`);

    if (!targetGzip || !targetBrotli) {
      console.error('');
      console.error('❌ Target cache policy does not have compression enabled!');
      console.error('   This should not happen. Please check the cache policy ID.');
      process.exit(1);
    }

    // Step 5: Update the distribution
    console.log('');
    console.log('⚙️  Step 5: Updating CloudFront distribution...');
    console.log(`   Changing cache policy from ${currentCachePolicyId} to ${COMPRESSION_ENABLED_CACHE_POLICY}`);
    console.log('');

    // Update the cache policy ID
    distConfig.DefaultCacheBehavior.CachePolicyId = COMPRESSION_ENABLED_CACHE_POLICY;

    await cloudfront.send(
      new UpdateDistributionCommand({
        Id: distributionId,
        DistributionConfig: distConfig,
        IfMatch: etag,
      })
    );

    console.log('✅ Distribution updated successfully!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Compression Fix Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Distribution: ${distributionId}`);
    console.log(`   Old Policy:   ${policyName}`);
    console.log(`   New Policy:   ${targetName}`);
    console.log(`   Compression:  Gzip ✅ | Brotli ✅`);
    console.log('');
    console.log('⏳ Note: CloudFront changes take 5-15 minutes to deploy globally.');
    console.log('   You can monitor deployment status in the AWS Console.');
    console.log('');
    console.log('🔄 Next Steps:');
    console.log('   1. Wait for CloudFront deployment to complete');
    console.log('   2. Test the application to verify no 6MB payload errors');
    console.log('   3. Monitor Lambda logs for any issues');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Fix Failed');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('');
    console.error(error.message);
    console.error('');

    if (error.name === 'PreconditionFailed') {
      console.error('⚠️  The distribution configuration has changed since we read it.');
      console.error('   Please run the script again.');
    } else if (error.name === 'NoSuchDistribution') {
      console.error('⚠️  Distribution not found. Check the domain name and try again.');
    } else if (error.name === 'AccessDenied') {
      console.error('⚠️  Insufficient permissions to update CloudFront distribution.');
      console.error('   Required permissions: cloudfront:GetDistribution, cloudfront:UpdateDistribution');
    }

    console.error('');
    process.exit(1);
  }
})();
