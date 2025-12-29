# SMS Outreach Production Deployment Plan

## Multi-Zone Integration with SleepConnect

**Date**: December 16, 2025  
**Target Environment**: dev.mydreamconnect.com  
**Architecture**: Multi-Zone Next.js with OpenNext + AWS Lambda + CloudFront  
**Status**: Ready for Implementation

---

## 📋 Overview

Deploy SMS Outreach app to work in multi-zone mode with SleepConnect:

- **Standalone URL**: `https://outreach.mydreamconnect.com` (independent access)
- **Integrated URL**: `https://dev.mydreamconnect.com/outreach/*` (proxied through SleepConnect)

### Architecture

```
User Request: dev.mydreamconnect.com/outreach/conversations
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ SleepConnect CloudFront (E2CJ0SW11QUMP8)                    │
│ - Path /outreach/* → Proxy to Outreach CloudFront          │
│ - JWT cookie forwarding                                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Outreach CloudFront (NEW)                                   │
│ - Host: outreach.mydreamconnect.com                         │
│ - Lambda Origin: Outreach SSR                               │
│ - S3 Origin: /outreach-static/* assets                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─→ /outreach/* → Lambda (Outreach SSR)
                 └─→ /outreach-static/* → S3 (Static Assets)
```

---

## 🎯 Implementation Steps

### Phase 1: AWS Infrastructure Setup (30-45 min)

#### Step 1.1: Create Lambda Function for Outreach

```bash
# Function naming convention: sax-lambda-us-east-1-0x-d-outreach-server_develop
aws lambda create-function \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::597088017323:role/lambda-dynamodb-execution-role \
  --memory-size 1024 \
  --timeout 30 \
  --zip-file fileb://dummy.zip \
  --region us-east-1
```

**Create Lambda Function URL**:

```bash
aws lambda create-function-url-config \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --auth-type NONE \
  --region us-east-1

# Save the returned FunctionUrl, e.g.:
# https://abc123xyz.lambda-url.us-east-1.on.aws/
```

#### Step 1.2: Create S3 Bucket for Outreach Static Assets

```bash
# Bucket naming: sax-nextjs-us-east-1-develop-outreach-assets
aws s3 mb s3://sax-nextjs-us-east-1-develop-outreach-assets \
  --region us-east-1

# Block public access (CloudFront OAC will access it)
aws s3api put-public-access-block \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

#### Step 1.3: Create CloudFront Distribution for Outreach

**Create Origin Access Control (OAC)**:

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "develop-outreach-s3-oac",
    "SigningProtocol": "sigv4",
    "SigningBehavior": "always",
    "OriginAccessControlOriginType": "s3"
  }' \
  --region us-east-1

# Save OAC ID, e.g.: E1234ABCDEF
```

**Create CloudFront Distribution** (use script at `twilio-conversations-react/scripts/setup-cloudfront-outreach.sh`):

```json
{
  "Comment": "Develop Outreach Zone - Multi-Zone with SleepConnect",
  "Enabled": true,
  "DefaultCacheBehavior": {
    "TargetOriginId": "lambda-ssr",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
    "CachedMethods": ["GET", "HEAD", "OPTIONS"],
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  },
  "Origins": [
    {
      "Id": "lambda-ssr",
      "DomainName": "abc123xyz.lambda-url.us-east-1.on.aws",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "https-only",
        "OriginSSLProtocols": ["TLSv1.2"]
      }
    },
    {
      "Id": "s3-assets",
      "DomainName": "sax-nextjs-us-east-1-develop-outreach-assets.s3.us-east-1.amazonaws.com",
      "S3OriginConfig": {},
      "OriginAccessControlId": "E1234ABCDEF"
    }
  ],
  "CacheBehaviors": [
    {
      "PathPattern": "/outreach-static/*",
      "TargetOriginId": "s3-assets",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "Compress": true
    },
    {
      "PathPattern": "/outreach-static/_next/*",
      "TargetOriginId": "s3-assets",
      "ViewerProtocolPolicy": "redirect-to-https",
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
      "Compress": true
    }
  ]
}
```

**Save Distribution ID** (e.g., `E3ABC123XYZ`)

#### Step 1.4: Update S3 Bucket Policy for OAC

```bash
cat > /tmp/outreach-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sax-nextjs-us-east-1-develop-outreach-assets/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::597088017323:distribution/E3ABC123XYZ"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --policy file:///tmp/outreach-bucket-policy.json
```

#### Step 1.5: Configure DNS for outreach.mydreamconnect.com

```bash
# Get hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='mydreamconnect.com.'].Id" \
  --output text | cut -d'/' -f3)

# Get CloudFront domain name
CF_DOMAIN=$(aws cloudfront get-distribution \
  --id E3ABC123XYZ \
  --query 'Distribution.DomainName' \
  --output text)

# Create A record
cat > /tmp/outreach-dns.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "outreach.mydreamconnect.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "$CF_DOMAIN",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/outreach-dns.json
```

---

### Phase 2: Deployment Script Creation (15-30 min)

#### Step 2.1: Create Deploy Script for Outreach

**File**: `twilio-conversations-react/scripts/deploy-outreach.cjs`

```javascript
#!/usr/bin/env node
/**
 * Outreach SMS App Deployment (No SST)
 * Deploys Outreach Next.js app to AWS Lambda using OpenNext
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENVIRONMENTS = {
  develop: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-d-outreach-server_develop',
    lambdaFunctionUrl: 'https://[YOUR-LAMBDA-URL].lambda-url.us-east-1.on.aws/',
    cloudfrontDistribution: 'E3ABC123XYZ', // Update with actual ID
    s3AssetsBucket: 'sax-nextjs-us-east-1-develop-outreach-assets',
    region: 'us-east-1',
    memory: 1024,
    timeout: 30,
  },
  // staging and production to be added later
};

const environment = process.argv[2] || 'develop';
const config = ENVIRONMENTS[environment];

if (!config) {
  console.error(`❌ Invalid environment: ${environment}`);
  process.exit(1);
}

const workspaceRoot = path.join(__dirname, '..');

try {
  console.log('🚀 Outreach SMS App Deployment');
  console.log(`Environment: ${environment}`);
  console.log('');

  // Step 1: Build Next.js
  console.log('📦 Step 1: Building Next.js...');
  execSync('npm run build', {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=4096'
    }
  });
  console.log('✅ Next.js build complete\\n');

  // Step 2: Build with OpenNext
  console.log('📦 Step 2: Building Lambda package with OpenNext...');
  execSync('npx @opennextjs/aws@3.6.6 build', {
    cwd: workspaceRoot,
    stdio: 'inherit'
  });
  console.log('✅ OpenNext build complete\\n');

  // Step 3: Zip server function
  console.log('🗜️  Step 3: Creating deployment package...');
  const openNextDir = path.join(workspaceRoot, '.open-next');
  const serverDir = path.join(openNextDir, 'server-functions', 'default');
  const zipFile = path.join(openNextDir, 'function.zip');

  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
  
  execSync(`cd "${serverDir}" && zip -r "${zipFile}" . -q`);
  
  const zipSizeMB = (fs.statSync(zipFile).size / 1024 / 1024).toFixed(2);
  console.log(`   Package size: ${zipSizeMB} MB`);
  console.log('✅ Deployment package created\\n');

  // Step 4: Update Lambda
  console.log('☁️  Step 4: Updating Lambda function...');
  execSync(
    `aws lambda update-function-code \
      --function-name "${config.lambdaFunction}" \
      --zip-file fileb://"${zipFile}" \
      --region ${config.region}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Lambda updated\\n');

  // Step 5: Wait for Lambda
  console.log('⏳ Step 5: Waiting for Lambda update...');
  execSync(
    `aws lambda wait function-updated \
      --function-name "${config.lambdaFunction}" \
      --region ${config.region}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Lambda ready\\n');

  // Step 6: Upload assets to S3
  const assetsDir = path.join(openNextDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    console.log('📤 Step 6: Uploading assets to S3...');
    
    // Upload _next directory with long cache
    const nextDir = path.join(assetsDir, '_next');
    if (fs.existsSync(nextDir)) {
      execSync(
        `aws s3 sync "${nextDir}" s3://${config.s3AssetsBucket}/outreach-static/_next \
          --delete \
          --cache-control "public,max-age=31536000,immutable" \
          --region ${config.region}`,
        { stdio: 'inherit' }
      );
    }

    // Upload root files
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

    console.log('✅ Assets uploaded\\n');
  }

  // Step 7: Invalidate CloudFront
  console.log('🔄 Step 7: Invalidating CloudFront...');
  execSync(
    `aws cloudfront create-invalidation \
      --distribution-id ${config.cloudfrontDistribution} \
      --paths "/outreach/*" "/outreach-static/*" \
      --region ${config.region}`,
    { stdio: 'inherit' }
  );
  console.log('✅ CloudFront invalidated\\n');

  // Success
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Deployment Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌍 URL: https://outreach.mydreamconnect.com/outreach`);
  console.log(`🔗 Multi-zone: https://dev.mydreamconnect.com/outreach`);

  // Cleanup
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);

} catch (error) {
  console.error('❌ Deployment Failed');
  console.error(error.message);
  process.exit(1);
}
```

Make it executable:

```bash
chmod +x twilio-conversations-react/scripts/deploy-outreach.cjs
```

---

### Phase 3: SleepConnect CloudFront Update (10-15 min)

#### Step 3.1: Add Origin for Outreach Zone to SleepConnect CloudFront

**File**: `sleepconnect/scripts/add-outreach-origin.sh`

```bash
#!/bin/bash
set -e

echo "🔧 Adding Outreach Origin to SleepConnect CloudFront"

SLEEPCONNECT_CF="E2CJ0SW11QUMP8"  # Develop CloudFront ID
OUTREACH_DOMAIN="d3abc123xyz.cloudfront.net"  # Outreach CloudFront domain

# Get current config
aws cloudfront get-distribution-config \
  --id $SLEEPCONNECT_CF \
  --output json > /tmp/sleepconnect-cf.json

ETAG=$(jq -r '.ETag' /tmp/sleepconnect-cf.json)

# Add Outreach origin
jq '.DistributionConfig.Origins.Items += [{
  "Id": "outreach-zone",
  "DomainName": "'$OUTREACH_DOMAIN'",
  "CustomOriginConfig": {
    "HTTPPort": 80,
    "HTTPSPort": 443,
    "OriginProtocolPolicy": "https-only",
    "OriginSSLProtocols": ["TLSv1.2"]
  },
  "ConnectionAttempts": 3,
  "ConnectionTimeout": 10
}] | .DistributionConfig.Origins.Quantity = (.DistributionConfig.Origins.Items | length)' \
  /tmp/sleepconnect-cf.json > /tmp/sleepconnect-cf-updated.json

# Add cache behavior for /outreach/*
jq '.DistributionConfig.CacheBehaviors.Items += [{
  "PathPattern": "/outreach/*",
  "TargetOriginId": "outreach-zone",
  "ViewerProtocolPolicy": "redirect-to-https",
  "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
  "CachedMethods": ["GET", "HEAD", "OPTIONS"],
  "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
  "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
  "Compress": true
}] | .DistributionConfig.CacheBehaviors.Quantity = (.DistributionConfig.CacheBehaviors.Items | length)' \
  /tmp/sleepconnect-cf-updated.json > /tmp/sleepconnect-cf-final.json

# Update distribution
jq '.DistributionConfig' /tmp/sleepconnect-cf-final.json > /tmp/sleepconnect-config.json

aws cloudfront update-distribution \
  --id $SLEEPCONNECT_CF \
  --distribution-config file:///tmp/sleepconnect-config.json \
  --if-match "$ETAG"

echo "✅ SleepConnect CloudFront updated"
echo "⏳ Deployment will take 2-3 minutes..."
```

---

### Phase 4: Environment Configuration (5-10 min)

#### Step 4.1: Create Production Environment File

**File**: `twilio-conversations-react/.env.production.develop`

```bash
# =============================================================================
# SMS Outreach - DEVELOP Environment
# =============================================================================

NODE_ENV=production

# Authentication (MANDATORY)
MULTI_ZONE_MODE=true
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_BASE_URL=https://dev.mydreamconnect.com

# Application URLs
NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com
NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com
NEXT_PUBLIC_BASE_PATH=/outreach

# API Configuration  
API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_WS_API_URL=wss://outreach-api.mydreamconnect.com

# Twilio (get from AWS Secrets Manager)
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_FROM_NUMBER=<your-twilio-phone>

# Feature Flags
ENABLE_SLA_MONITORING=true
NEXT_PUBLIC_ENABLE_SLA_MONITORING=true

# Branding
NEXT_PUBLIC_PRACTICE_NAME=Sleep Architects
NEXT_PUBLIC_SHOW_BANNER=false
```

---

### Phase 5: Build & Deploy (20-30 min)

#### Step 5.1: Test Build Locally

```bash
cd ~/code/SAX/twilio-conversations-react

# Install dependencies
npm install

# Build Next.js
NODE_ENV=production npm run build

# Verify build
ls -la .next/
```

#### Step 5.2: Run Deployment Script

```bash
# Deploy to develop
node scripts/deploy-outreach.cjs develop

# Expected output:
# ✅ Next.js build complete
# ✅ OpenNext build complete
# ✅ Deployment package created
# ✅ Lambda updated
# ✅ Assets uploaded
# ✅ CloudFront invalidated
# ✅ Deployment Complete!
```

#### Step 5.3: Update SleepConnect CloudFront

```bash
cd ~/code/SAX/sleepconnect

# Run the add-outreach-origin script
bash scripts/add-outreach-origin.sh

# Wait 2-3 minutes for CloudFront deployment
```

---

### Phase 6: Testing & Validation (15-20 min)

#### Step 6.1: Health Checks

```bash
# Test Outreach standalone
curl -I https://outreach.mydreamconnect.com/outreach

# Test multi-zone proxy
curl -I https://dev.mydreamconnect.com/outreach

# Test static assets
curl -I https://outreach.mydreamconnect.com/outreach-static/_next/static/chunks/main.js
```

#### Step 6.2: Browser Testing

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Navigate to** `https://dev.mydreamconnect.com/outreach/conversations`
3. **Expected**: Login with Auth0, then see conversations list
4. **Check**:
   - JWT cookie `x-sax-user-context` exists
   - Static assets load from `/outreach-static/`
   - Real-time WebSocket updates work
   - No console errors

#### Step 6.3: End-to-End Test

1. Login to `https://dev.mydreamconnect.com`
2. Navigate to `/outreach`
3. Create new conversation
4. Send SMS message
5. Verify message appears in list
6. Check SLA status updates

---

## 📊 Resource Summary

### AWS Resources Created

| Resource Type | Name/ID | Purpose |
|--------------|---------|---------|
| Lambda Function | `sax-lambda-us-east-1-0x-d-outreach-server_develop` | SSR for Outreach |
| Lambda URL | `https://[abc].lambda-url.us-east-1.on.aws/` | Lambda endpoint |
| S3 Bucket | `sax-nextjs-us-east-1-develop-outreach-assets` | Static assets |
| CloudFront | `E3ABC123XYZ` (new) | Outreach CDN |
| Route53 | `outreach.mydreamconnect.com` | DNS record |
| OAC | `E1234ABCDEF` | S3 access control |

### Modified Resources

| Resource | Change |
|----------|--------|
| SleepConnect CloudFront (`E2CJ0SW11QUMP8`) | Added origin + cache behavior for `/outreach/*` |
| SleepConnect `next.config.js` | Already has rewrites configured ✅ |

---

## 🔧 Configuration Files

### Files to Create

```
twilio-conversations-react/
├── scripts/
│   ├── deploy-outreach.cjs          # Main deployment script
│   └── setup-cloudfront-outreach.sh # CloudFront setup script
├── .env.production.develop          # Develop environment vars
├── .env.production.staging          # Staging environment vars (future)
└── .env.production.production       # Production environment vars (future)

sleepconnect/
└── scripts/
    └── add-outreach-origin.sh       # Update SleepConnect CloudFront
```

---

## 🚨 Troubleshooting

### Issue: 403 on Static Assets

**Cause**: S3 bucket policy not allowing CloudFront OAC

**Solution**:

```bash
# Re-apply bucket policy
bash twilio-conversations-react/scripts/setup-cloudfront-outreach.sh
```

### Issue: /outreach/* returns 404 on dev.mydreamconnect.com

**Cause**: SleepConnect CloudFront not configured to proxy

**Solution**:

```bash
# Add origin and cache behavior
bash sleepconnect/scripts/add-outreach-origin.sh

# Wait 2-3 minutes, then test
curl -I https://dev.mydreamconnect.com/outreach
```

### Issue: Authentication loop

**Cause**: JWT cookie not being forwarded

**Solution**:

1. Check middleware in both apps
2. Verify cookie domain is `.mydreamconnect.com`
3. Ensure `MULTI_ZONE_MODE=true` in Outreach .env

---

## 📝 Deployment Checklist

### Pre-Deployment

- [ ] All Lambda functions deployed (sms-outreach)
- [ ] API Gateway endpoints working
- [ ] Database migrations applied
- [ ] Environment variables configured

### Infrastructure Setup

- [ ] Lambda function created
- [ ] Lambda URL generated
- [ ] S3 bucket created
- [ ] CloudFront OAC created
- [ ] CloudFront distribution created
- [ ] DNS record created
- [ ] S3 bucket policy updated

### Code Deployment

- [ ] Deploy script created (`deploy-outreach.cjs`)
- [ ] Build successful (`npm run build`)
- [ ] OpenNext build successful
- [ ] Lambda updated
- [ ] Assets uploaded to S3
- [ ] CloudFront invalidated

### Integration

- [ ] SleepConnect CloudFront updated
- [ ] Origin added for Outreach
- [ ] Cache behavior added for `/outreach/*`
- [ ] CloudFront deployment complete (wait 2-3 min)

### Testing

- [ ] Standalone access works (`outreach.mydreamconnect.com`)
- [ ] Multi-zone access works (`dev.mydreamconnect.com/outreach`)
- [ ] Authentication flow working
- [ ] Static assets loading
- [ ] WebSocket connections working
- [ ] Real-time updates working
- [ ] SLA monitoring functional

### Post-Deployment

- [ ] Monitor CloudWatch logs
- [ ] Check error rates
- [ ] Verify performance metrics
- [ ] Document any issues
- [ ] Update team on deployment

---

## 🎓 Key Concepts

### Multi-Zone Architecture

Multi-zone allows you to compose multiple Next.js applications under a single domain:

- Each "zone" is an independent Next.js app
- Zones are connected via CloudFront path-based routing
- Each zone has its own Lambda function and S3 bucket
- Zones can be deployed independently

### Why Multi-Zone?

1. **Separation of Concerns**: Outreach and SleepConnect are separate codebases
2. **Independent Scaling**: Each zone scales independently
3. **Isolated Deployments**: Deploy Outreach without affecting SleepConnect
4. **Team Autonomy**: Different teams can own different zones

### How It Works

```
Request: dev.mydreamconnect.com/outreach/conversations
             ↓
SleepConnect CloudFront checks path
             ↓
Matches /outreach/* → Route to Outreach origin
             ↓
Outreach CloudFront
             ↓
Check path:
  /outreach-static/* → S3
  /outreach/* → Lambda
```

---

## 📞 Next Steps

1. **Create AWS Resources** (Phase 1)
2. **Create Deployment Scripts** (Phase 2)
3. **Test Locally** (Phase 5.1)
4. **Deploy to Develop** (Phase 5.2)
5. **Update SleepConnect** (Phase 5.3)
6. **Test End-to-End** (Phase 6)
7. **Monitor & Iterate**

---

**Estimated Total Time**: 2-3 hours  
**Complexity**: Medium  
**Risk Level**: Low (can rollback easily)  
**Dependencies**: AWS CLI, Node.js, existing infrastructure

**Ready to deploy?** Start with Phase 1! 🚀
