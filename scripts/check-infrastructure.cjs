const { LambdaClient, GetFunctionCommand } = require('@aws-sdk/client-lambda');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient, ListDistributionsCommand } = require('@aws-sdk/client-cloudfront');
const { ACMClient, ListCertificatesCommand } = require('@aws-sdk/client-acm');
const { Route53Client, ListResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
const { IAMClient, GetRoleCommand } = require('@aws-sdk/client-iam');
const { getResourceNames, HOSTED_ZONE_ID } = require('./aws-config');

const REGION = 'us-east-1';

// Initialize clients
const lambda = new LambdaClient({ region: REGION });
const s3 = new S3Client({ region: REGION });
const cloudfront = new CloudFrontClient({ region: REGION });
const acm = new ACMClient({ region: REGION });
const route53 = new Route53Client({ region: REGION });
const iam = new IAMClient({ region: REGION });

async function checkInfrastructure() {
  const env = process.argv[2];
  if (!env) {
    console.error('Usage: node check-infrastructure.cjs <environment>');
    process.exit(1);
  }

  console.log(`🔍 Checking infrastructure for [${env}]...`);
  const resources = getResourceNames(env);
  const missing = [];
  const status = {};

  // 1. Check IAM Role
  try {
    await iam.send(new GetRoleCommand({ RoleName: resources.roleName }));
    status.iam = '✅ Found';
  } catch (e) {
    if (e.name === 'NoSuchEntityException') {
      status.iam = '❌ Missing';
      missing.push('IAM Role');
    } else {
      throw e;
    }
  }

  // 2. Check S3 Bucket
  try {
    await s3.send(new HeadBucketCommand({ Bucket: resources.bucketName }));
    status.s3 = '✅ Found';
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      status.s3 = '❌ Missing';
      missing.push('S3 Bucket');
    } else if (e.$metadata?.httpStatusCode === 403) {
      status.s3 = '🚫 Access Denied (Exists)';
    } else {
      throw e;
    }
  }

  // 3. Check Lambda
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: resources.lambdaName }));
    status.lambda = '✅ Found';
  } catch (e) {
    if (e.name === 'ResourceNotFoundException') {
      status.lambda = '❌ Missing';
      missing.push('Lambda Function');
    } else {
      throw e;
    }
  }

  // 4. Check ACM Certificate
  try {
    const certs = await acm.send(new ListCertificatesCommand({}));
    const cert = certs.CertificateSummaryList.find(c => c.DomainName === resources.domainName);
    if (cert) {
      status.acm = `✅ Found (${cert.Status})`;
      if (cert.Status !== 'ISSUED') {
        missing.push(`ACM Certificate (Status: ${cert.Status})`);
      }
    } else {
      status.acm = '❌ Missing';
      missing.push('ACM Certificate');
    }
  } catch (e) {
    console.error('Error checking ACM:', e.message);
    status.acm = '⚠️ Error';
  }

  // 5. Check CloudFront (By Alias/CNAME)
  let distributionId = null;
  try {
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

    if (found) {
      status.cloudfront = `✅ Found (${distributionId})`;
    } else {
      status.cloudfront = '❌ Missing';
      missing.push('CloudFront Distribution');
    }
  } catch (e) {
    console.error('Error checking CloudFront:', e.message);
    status.cloudfront = '⚠️ Error';
  }

  // 6. Check Route53
  try {
    const records = await route53.send(new ListResourceRecordSetsCommand({
      HostedZoneId: HOSTED_ZONE_ID,
      StartRecordName: resources.domainName,
      MaxItems: 1
    }));
    
    const record = records.ResourceRecordSets[0];
    if (record && record.Name === `${resources.domainName}.`) { // Route53 adds trailing dot
      status.route53 = '✅ Found';
    } else {
      status.route53 = '❌ Missing';
      missing.push('Route53 Record');
    }
  } catch (e) {
    console.error('Error checking Route53:', e.message);
    status.route53 = '⚠️ Error';
  }

  // Report
  console.log('\nInfrastructure Status:');
  console.table(status);

  if (missing.length > 0) {
    console.log(`\n❌ Missing Resources: ${missing.join(', ')}`);
    // Output JSON for scripts to parse
    console.log(`\nJSON_OUTPUT=${JSON.stringify({ ready: false, missing })}`);
    process.exit(1);
  } else {
    console.log('\n✅ Infrastructure Ready');
    console.log(`\nJSON_OUTPUT=${JSON.stringify({ ready: true, missing: [] })}`);
  }
}

checkInfrastructure().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
