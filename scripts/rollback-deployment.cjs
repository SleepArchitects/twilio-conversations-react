const { 
  LambdaClient, UpdateAliasCommand, ListVersionsByFunctionCommand, GetAliasCommand 
} = require('@aws-sdk/client-lambda');
const { 
  CloudFrontClient, CreateInvalidationCommand, ListDistributionsCommand 
} = require('@aws-sdk/client-cloudfront');
const { getResourceNames } = require('./aws-config');

const REGION = 'us-east-1';
const lambda = new LambdaClient({ region: REGION });
const cloudfront = new CloudFrontClient({ region: REGION });

async function rollback() {
  const env = process.argv[2];
  const targetVersion = process.argv[3]; // Optional: Version number or 'prev'

  if (!env) {
    console.error('Usage: node rollback-deployment.cjs <environment> [version]');
    process.exit(1);
  }

  const resources = getResourceNames(env);
  console.log(`⏪ Rolling back [${env}]...`);

  // 1. Get current alias version
  let currentVersion;
  try {
    const alias = await lambda.send(new GetAliasCommand({
      FunctionName: resources.lambdaName,
      Name: 'live'
    }));
    currentVersion = alias.FunctionVersion;
    console.log(`   Current 'live' version: ${currentVersion}`);
  } catch (e) {
    console.error('Error getting alias:', e.message);
    process.exit(1);
  }

  // 2. Determine target version
  let newVersion = targetVersion;
  if (!newVersion || newVersion === 'prev') {
    // Find previous version
    const versions = await lambda.send(new ListVersionsByFunctionCommand({
      FunctionName: resources.lambdaName
    }));
    // Sort numeric versions desc
    const sorted = versions.Versions
      .filter(v => !isNaN(parseInt(v.Version)))
      .sort((a, b) => parseInt(b.Version) - parseInt(a.Version));
    
    // Find current index
    const currentIndex = sorted.findIndex(v => v.Version === currentVersion);
    if (currentIndex === -1 || currentIndex === sorted.length - 1) {
      console.error('❌ Cannot determine previous version (Current is oldest or unknown)');
      process.exit(1);
    }
    newVersion = sorted[currentIndex + 1].Version;
  }

  console.log(`   Targeting version: ${newVersion}`);

  // 3. Update Alias
  await lambda.send(new UpdateAliasCommand({
    FunctionName: resources.lambdaName,
    Name: 'live',
    FunctionVersion: newVersion
  }));
  console.log(`✅ Updated alias 'live' -> v${newVersion}`);

  // 4. Invalidate CloudFront
  // Find distribution first
  let distributionId = null;
  let found = false;
  let marker = undefined;
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
    console.log(`⚡ Invalidating CloudFront (${distributionId})...`);
    await cloudfront.send(new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `rollback-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ['/*'] 
        }
      }
    }));
    console.log('✅ Invalidation requested');
  } else {
    console.warn('⚠️  Could not find CloudFront distribution for invalidation');
  }
}

rollback().catch(console.error);
