# Outreach App Infrastructure Setup

**Critical:** Infrastructure must be created ONCE and then updated (never deleted). This document covers the complete AWS infrastructure setup required before the first deployment.

---

## Overview

The Outreach app requires these AWS resources:

1. **Route 53** - DNS records for subdomains
2. **ACM** - SSL/TLS certificates for HTTPS
3. **S3** - Static asset storage buckets
4. **Lambda** - Function for Next.js server-side rendering
5. **CloudFront** - CDN distributions for content delivery
6. **IAM** - Roles and policies for Lambda execution

**⚠️ CRITICAL RULE:** Once created, these resources are UPDATED, never deleted. All scripts must use update/upsert operations.

---

## Prerequisites

- AWS CLI configured with appropriate credentials
- Access to Route 53 hosted zone for domain
- Permissions to create: Lambda, CloudFront, S3, ACM, Route 53, IAM
- Domain ownership verified in Route 53

---

## Step 1: Route 53 DNS Setup

### 1.1 Get Hosted Zone ID

```bash
# List hosted zones
aws route53 list-hosted-zones-by-name

# Get zone ID for your domain
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --query "HostedZones[?Name=='mydreamconnect.com.'].Id" \
  --output text | cut -d'/' -f3)

echo "Hosted Zone ID: $HOSTED_ZONE_ID"
```

### 1.2 Create Subdomain Records

**For Development:**

```bash
# Create outreach.mydreamconnect.com pointing to CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "outreach.mydreamconnect.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234567890.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**Note:** Use `UPSERT` (not `CREATE`) so it updates existing records instead of failing.

**For Staging:**

```bash
# Create outreach-staging.mydreamconnect.com
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "outreach-staging.mydreamconnect.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d0987654321.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**For Production:**

```bash
# Create outreach.dreamconnect.health
PROD_HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --query "HostedZones[?Name=='dreamconnect.health.'].Id" \
  --output text | cut -d'/' -f3)

aws route53 change-resource-record-sets \
  --hosted-zone-id $PROD_HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "outreach.dreamconnect.health",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1111111111.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

---

## Step 2: ACM Certificate Setup

### 2.1 Request Certificate (One-Time)

**⚠️ IMPORTANT:** Certificates must be created in `us-east-1` for CloudFront.

**Development:**

```bash
# Request certificate for outreach.mydreamconnect.com
aws acm request-certificate \
  --domain-name outreach.mydreamconnect.com \
  --validation-method DNS \
  --region us-east-1 \
  --tags Key=Environment,Value=develop Key=Service,Value=outreach

# Save the Certificate ARN
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='outreach.mydreamconnect.com'].CertificateArn" \
  --output text)

echo "Certificate ARN: $CERT_ARN"
```

**Staging:**

```bash
aws acm request-certificate \
  --domain-name outreach-staging.mydreamconnect.com \
  --validation-method DNS \
  --region us-east-1 \
  --tags Key=Environment,Value=staging Key=Service,Value=outreach
```

**Production:**

```bash
aws acm request-certificate \
  --domain-name outreach.dreamconnect.health \
  --validation-method DNS \
  --region us-east-1 \
  --tags Key=Environment,Value=production Key=Service,Value=outreach
```

### 2.2 Validate Certificate (One-Time)

```bash
# Get validation CNAME records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# Output will be:
# {
#   "Name": "_abc123.outreach.mydreamconnect.com",
#   "Type": "CNAME",
#   "Value": "_xyz789.acm-validations.aws"
# }

# Add CNAME record to Route 53 for validation
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_abc123.outreach.mydreamconnect.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "_xyz789.acm-validations.aws"}]
      }
    }]
  }'

# Wait for validation (takes 5-30 minutes)
aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN \
  --region us-east-1

echo "✅ Certificate validated!"
```

---

## Step 3: S3 Buckets for Static Assets

### 3.1 Create Buckets (One-Time)

**Development:**

```bash
# Create S3 bucket for static assets
aws s3 mb s3://sax-nextjs-us-east-1-develop-outreach-assets \
  --region us-east-1

# Block public access (CloudFront will access via OAI)
aws s3api put-public-access-block \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable versioning (for rollback capability)
aws s3api put-bucket-versioning \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --versioning-configuration Status=Enabled

# Add lifecycle policy to clean up old versions (optional)
aws s3api put-bucket-lifecycle-configuration \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldVersions",
      "Status": "Enabled",
      "NoncurrentVersionExpiration": {"NoncurrentDays": 90}
    }]
  }'
```

**Staging:**

```bash
aws s3 mb s3://sax-nextjs-us-east-1-staging-outreach-assets --region us-east-1
aws s3api put-public-access-block \
  --bucket sax-nextjs-us-east-1-staging-outreach-assets \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-versioning \
  --bucket sax-nextjs-us-east-1-staging-outreach-assets \
  --versioning-configuration Status=Enabled
```

**Production:**

```bash
aws s3 mb s3://sax-nextjs-us-east-production-outreach-assets --region us-east-1
aws s3api put-public-access-block \
  --bucket sax-nextjs-us-east-production-outreach-assets \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-bucket-versioning \
  --bucket sax-nextjs-us-east-production-outreach-assets \
  --versioning-configuration Status=Enabled
```

---

## Step 4: Lambda Function Setup

### 4.1 Create IAM Role (One-Time)

```bash
# Create Lambda execution role
aws iam create-role \
  --role-name sax-lambda-outreach-execution-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name sax-lambda-outreach-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Wait for role to propagate
sleep 10
```

### 4.2 Create Lambda Functions (One-Time)

**Development:**

```bash
# Create placeholder function (will be updated by deployment script)
cat > /tmp/placeholder.js << 'EOF'
exports.handler = async (event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({message: 'Placeholder - awaiting first deployment'})
  };
};
EOF

cd /tmp
zip placeholder.zip placeholder.js

# Create Lambda function
aws lambda create-function \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --runtime nodejs20.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):iam::role/sax-lambda-outreach-execution-role \
  --handler index.handler \
  --zip-file fileb://placeholder.zip \
  --timeout 30 \
  --memory-size 1024 \
  --environment Variables="{NODE_ENV=production,NEXT_TELEMETRY_DISABLED=1}" \
  --region us-east-1

# Create Function URL (for direct access)
FUNCTION_URL=$(aws lambda create-function-url-config \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --auth-type NONE \
  --region us-east-1 \
  --query FunctionUrl \
  --output text)

echo "Function URL: $FUNCTION_URL"

# Add permission for Function URL
aws lambda add-permission \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region us-east-1

rm /tmp/placeholder.js /tmp/placeholder.zip
```

**Staging:**

```bash
# Same process but with staging function name
aws lambda create-function \
  --function-name sax-lambda-us-east-1-0x-s-outreach-server_staging \
  --runtime nodejs20.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):iam::role/sax-lambda-outreach-execution-role \
  --handler index.handler \
  --zip-file fileb:///tmp/placeholder.zip \
  --timeout 30 \
  --memory-size 1024 \
  --region us-east-1
```

**Production:**

```bash
aws lambda create-function \
  --function-name sax-lambda-us-east-1-0x-p-outreach-server_production \
  --runtime nodejs20.x \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):iam::role/sax-lambda-outreach-execution-role \
  --handler index.handler \
  --zip-file fileb:///tmp/placeholder.zip \
  --timeout 30 \
  --memory-size 2048 \
  --region us-east-1
```

---

## Step 5: CloudFront Distribution Setup

### 5.1 Create Origin Access Identity (OAI) for S3

```bash
# Create OAI for S3 access
OAI_ID=$(aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config \
    "CallerReference=$(date +%s),Comment=OAI for Outreach static assets" \
  --query 'CloudFrontOriginAccessIdentity.Id' \
  --output text)

echo "OAI ID: $OAI_ID"

# Update S3 bucket policy to allow CloudFront access
aws s3api put-bucket-policy \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "CloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity '"$OAI_ID"'"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sax-nextjs-us-east-1-develop-outreach-assets/*"
    }]
  }'
```

### 5.2 Create CloudFront Distribution

**Save this as:** `cloudfront-config-develop.json`

```json
{
  "CallerReference": "outreach-develop-2025-12-16",
  "Comment": "Outreach SMS App - Development",
  "Enabled": true,
  "DefaultRootObject": "",
  "Origins": [
    {
      "Id": "OutreachLambdaOrigin",
      "DomainName": "YOUR_FUNCTION_URL.lambda-url.us-east-1.on.aws",
      "CustomOriginConfig": {
        "HTTPPort": 80,
        "HTTPSPort": 443,
        "OriginProtocolPolicy": "https-only",
        "OriginSslProtocols": ["TLSv1.2"],
        "OriginReadTimeout": 30,
        "OriginKeepaliveTimeout": 5
      }
    },
    {
      "Id": "OutreachS3AssetsOrigin",
      "DomainName": "sax-nextjs-us-east-1-develop-outreach-assets.s3.us-east-1.amazonaws.com",
      "S3OriginConfig": {
        "OriginAccessIdentity": "origin-access-identity/cloudfront/YOUR_OAI_ID"
      }
    }
  ],
  "DefaultCacheBehavior": {
    "TargetOriginId": "OutreachLambdaOrigin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
    "CachedMethods": ["GET", "HEAD", "OPTIONS"],
    "Compress": true,
    "ForwardedValues": {
      "QueryString": true,
      "Cookies": {"Forward": "all"},
      "Headers": ["*"]
    },
    "MinTTL": 0,
    "DefaultTTL": 0,
    "MaxTTL": 31536000
  },
  "CacheBehaviors": [
    {
      "PathPattern": "/outreach/api/*",
      "TargetOriginId": "OutreachLambdaOrigin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"],
      "CachedMethods": ["GET", "HEAD", "OPTIONS"],
      "Compress": true,
      "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
      "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
    },
    {
      "PathPattern": "/outreach-static/*",
      "TargetOriginId": "OutreachS3AssetsOrigin",
      "ViewerProtocolPolicy": "redirect-to-https",
      "AllowedMethods": ["GET", "HEAD", "OPTIONS"],
      "CachedMethods": ["GET", "HEAD", "OPTIONS"],
      "Compress": true,
      "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f3"
    }
  ],
  "Aliases": ["outreach.mydreamconnect.com"],
  "ViewerCertificate": {
    "ACMCertificateArn": "YOUR_CERTIFICATE_ARN",
    "SSLSupportMethod": "sni-only",
    "MinimumProtocolVersion": "TLSv1.2_2021"
  },
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true,
  "PriceClass": "PriceClass_100"
}
```

**Create distribution:**

```bash
# Update placeholders in config
sed -i "s/YOUR_FUNCTION_URL/$FUNCTION_URL/g" cloudfront-config-develop.json
sed -i "s/YOUR_OAI_ID/$OAI_ID/g" cloudfront-config-develop.json
sed -i "s/YOUR_CERTIFICATE_ARN/$CERT_ARN/g" cloudfront-config-develop.json

# Create distribution
DISTRIBUTION_ID=$(aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config-develop.json \
  --query 'Distribution.Id' \
  --output text)

echo "Distribution ID: $DISTRIBUTION_ID"

# Get distribution domain name
CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query 'Distribution.DomainName' \
  --output text)

echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
```

### 5.3 Update Route 53 with CloudFront Domain

```bash
# Update the DNS record created earlier with actual CloudFront domain
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "outreach.mydreamconnect.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "'"$CLOUDFRONT_DOMAIN"'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

---

## Step 6: Update Deployment Script

Update the environment configuration in `deploy-outreach.cjs`:

```javascript
const ENVIRONMENTS = {
  develop: {
    lambdaFunction: 'sax-lambda-us-east-1-0x-d-outreach-server_develop',
    lambdaFunctionUrl: 'https://abc123xyz.lambda-url.us-east-1.on.aws/',  // From Step 4
    cloudfrontDistribution: 'E3ABC123XYZ',  // From Step 5
    s3AssetsBucket: 'sax-nextjs-us-east-1-develop-outreach-assets',
    region: 'us-east-1',
    memory: 1024,
    timeout: 30,
  },
  // ... staging and production
};
```

---

## Resource Reference

After setup, document these values for each environment:

### Development

```bash
# Save these values in a secure location
DEVELOP_CERT_ARN=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID
DEVELOP_DISTRIBUTION_ID=E3ABC123XYZ
DEVELOP_FUNCTION_URL=https://abc123xyz.lambda-url.us-east-1.on.aws/
DEVELOP_OAI_ID=E4DEF456UVW
```

### Staging

```bash
STAGING_CERT_ARN=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID
STAGING_DISTRIBUTION_ID=E5GHI789RST
STAGING_FUNCTION_URL=https://def456uvw.lambda-url.us-east-1.on.aws/
STAGING_OAI_ID=E6JKL012MNO
```

### Production

```bash
PRODUCTION_CERT_ARN=arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID
PRODUCTION_DISTRIBUTION_ID=E7PQR345XYZ
PRODUCTION_FUNCTION_URL=https://ghi789rst.lambda-url.us-east-1.on.aws/
PRODUCTION_OAI_ID=E8STU678ABC
```

---

## Infrastructure as Code Alternative

Instead of manual AWS CLI commands, consider using:

### Option 1: AWS CloudFormation

Create `infrastructure/outreach-stack.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Outreach SMS App Infrastructure

Parameters:
  Environment:
    Type: String
    AllowedValues: [develop, staging, production]
  DomainName:
    Type: String
    Description: Domain for the app (e.g., outreach.mydreamconnect.com)

Resources:
  # S3 Bucket
  AssetsBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'sax-nextjs-us-east-1-${Environment}-outreach-assets'
      VersioningConfiguration:
        Status: Enabled
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true

  # Lambda Execution Role
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub 'sax-lambda-outreach-execution-role-${Environment}'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  # Lambda Function
  ServerFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub 'sax-lambda-us-east-1-0x-${Environment:0:1}-outreach-server_${Environment}'
      Runtime: nodejs20.x
      Handler: index.handler
      Role: !GetAtt LambdaExecutionRole.Arn
      Timeout: 30
      MemorySize: !If [IsProduction, 2048, 1024]
      Code:
        ZipFile: |
          exports.handler = async () => ({
            statusCode: 200,
            body: 'Placeholder'
          });

Outputs:
  BucketName:
    Value: !Ref AssetsBucket
  FunctionName:
    Value: !Ref ServerFunction
```

Deploy:

```bash
aws cloudformation deploy \
  --template-file infrastructure/outreach-stack.yaml \
  --stack-name outreach-develop \
  --parameter-overrides \
    Environment=develop \
    DomainName=outreach.mydreamconnect.com \
  --capabilities CAPABILITY_NAMED_IAM
```

### Option 2: AWS CDK

More flexible and programmatic. See CDK documentation.

### Option 3: Terraform

Infrastructure as code with state management.

---

## Maintenance

### Updating Resources (Not Deleting)

**Lambda Function:** Use `update-function-code` (done by deployment script)

**CloudFront Distribution:**

```bash
# Get current config
aws cloudfront get-distribution-config \
  --id $DISTRIBUTION_ID \
  --query 'DistributionConfig' \
  > current-config.json

# Edit current-config.json with changes

# Update distribution
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --distribution-config file://current-config.json \
  --if-match $(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'ETag' --output text)
```

**S3 Bucket:** Never delete - use versioning and lifecycle policies

**Lambda:** Never delete - update code and configuration only

---

## Security Checklist

- [ ] S3 buckets have public access blocked
- [ ] CloudFront uses HTTPS only (TLSv1.2+)
- [ ] ACM certificates are valid and auto-renewing
- [ ] Lambda has minimal IAM permissions
- [ ] CloudFront uses signed URLs/cookies for protected content (if needed)
- [ ] Route 53 records use DNSSEC (optional)

---

## Cost Optimization

- **CloudFront:** Use `PriceClass_100` (US, Canada, Europe only) for dev/staging
- **Lambda:** Right-size memory (1024MB for dev, 2048MB for prod)
- **S3:** Enable intelligent tiering for large assets
- **CloudFront:** Use cache policies effectively to reduce origin requests

---

**Last Updated:** December 16, 2025  
**Status:** Complete infrastructure setup guide
