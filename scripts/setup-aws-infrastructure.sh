#!/bin/bash

# AWS Infrastructure Setup Script for SMS Outreach
# This script creates all necessary AWS resources for deploying the Next.js app
# Prerequisites: AWS CLI installed and configured with appropriate credentials

set -e  # Exit on any error

# Configuration
PROJECT_NAME="outreach-mydreamconnect"
REGION="us-east-1"  # Required for CloudFront certificates
DOMAIN="outreach.mydreamconnect.com"
ENVIRONMENT="${1:-production}"  # Default to production, can pass 'develop' or 'staging'

echo "🚀 Setting up AWS infrastructure for ${PROJECT_NAME} (${ENVIRONMENT})"
echo "Region: ${REGION}"
echo "Domain: ${DOMAIN}"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
        echo "Install guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI is installed${NC}"
}

# Function to check AWS credentials
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials are not configured properly.${NC}"
        echo "Run: aws configure"
        exit 1
    fi
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}✅ AWS credentials verified (Account: ${ACCOUNT_ID})${NC}"
}

# Function to create S3 bucket for static assets
create_s3_bucket() {
    BUCKET_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
    
    echo -e "\n${YELLOW}📦 Creating S3 bucket: ${BUCKET_NAME}${NC}"
    
    # Check if bucket already exists
    if aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
        # Create bucket
        if [ "$REGION" == "us-east-1" ]; then
            aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
        else
            aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}" \
                --create-bucket-configuration LocationConstraint="${REGION}"
        fi
        echo -e "${GREEN}✅ S3 bucket created: ${BUCKET_NAME}${NC}"
    else
        echo -e "${YELLOW}⚠️  S3 bucket already exists: ${BUCKET_NAME}${NC}"
    fi
    
    # Enable versioning (optional but recommended)
    aws s3api put-bucket-versioning \
        --bucket "${BUCKET_NAME}" \
        --versioning-configuration Status=Enabled
    echo -e "${GREEN}✅ Versioning enabled${NC}"
    
    # Block public access (CloudFront will access via OAI)
    aws s3api put-public-access-block \
        --bucket "${BUCKET_NAME}" \
        --public-access-block-configuration \
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    echo -e "${GREEN}✅ Public access blocked${NC}"
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "${BUCKET_NAME}" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                },
                "BucketKeyEnabled": true
            }]
        }'
    echo -e "${GREEN}✅ Encryption enabled${NC}"
    
    # Add lifecycle policy to clean up old versions after 30 days (optional)
    aws s3api put-bucket-lifecycle-configuration \
        --bucket "${BUCKET_NAME}" \
        --lifecycle-configuration '{
            "Rules": [{
                "Id": "DeleteOldVersions",
                "Status": "Enabled",
                "NoncurrentVersionExpiration": {
                    "NoncurrentDays": 30
                }
            }]
        }'
    echo -e "${GREEN}✅ Lifecycle policy configured${NC}"
}

# Function to create CloudFront Origin Access Identity
create_oai() {
    echo -e "\n${YELLOW}🔐 Creating CloudFront Origin Access Identity${NC}"
    
    OAI_COMMENT="${PROJECT_NAME}-${ENVIRONMENT}-oai"
    
    # Check if OAI already exists
    EXISTING_OAI=$(aws cloudfront list-cloud-front-origin-access-identities \
        --query "CloudFrontOriginAccessIdentityList.Items[?Comment=='${OAI_COMMENT}'].Id" \
        --output text)
    
    if [ -n "$EXISTING_OAI" ]; then
        OAI_ID="$EXISTING_OAI"
        echo -e "${YELLOW}⚠️  OAI already exists: ${OAI_ID}${NC}"
    else
        OAI_RESULT=$(aws cloudfront create-cloud-front-origin-access-identity \
            --cloud-front-origin-access-identity-config \
            "CallerReference=$(date +%s),Comment=${OAI_COMMENT}")
        
        OAI_ID=$(echo "$OAI_RESULT" | jq -r '.CloudFrontOriginAccessIdentity.Id')
        echo -e "${GREEN}✅ OAI created: ${OAI_ID}${NC}"
    fi
    
    # Update S3 bucket policy to allow CloudFront access
    BUCKET_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
    OAI_ARN="arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${OAI_ID}"
    
    cat > /tmp/bucket-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontOAI",
            "Effect": "Allow",
            "Principal": {
                "AWS": "${OAI_ARN}"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
        }
    ]
}
EOF
    
    aws s3api put-bucket-policy \
        --bucket "${BUCKET_NAME}" \
        --policy file:///tmp/bucket-policy.json
    
    echo -e "${GREEN}✅ S3 bucket policy updated${NC}"
    rm /tmp/bucket-policy.json
}

# Function to request ACM certificate
request_certificate() {
    echo -e "\n${YELLOW}🔒 Requesting ACM certificate for ${DOMAIN}${NC}"
    
    # Check if certificate already exists
    EXISTING_CERT=$(aws acm list-certificates \
        --region us-east-1 \
        --query "CertificateSummaryList[?DomainName=='${DOMAIN}'].CertificateArn" \
        --output text)
    
    if [ -n "$EXISTING_CERT" ]; then
        CERT_ARN="$EXISTING_CERT"
        echo -e "${YELLOW}⚠️  Certificate already exists: ${CERT_ARN}${NC}"
    else
        CERT_RESULT=$(aws acm request-certificate \
            --domain-name "${DOMAIN}" \
            --validation-method DNS \
            --region us-east-1)
        
        CERT_ARN=$(echo "$CERT_RESULT" | jq -r '.CertificateArn')
        echo -e "${GREEN}✅ Certificate requested: ${CERT_ARN}${NC}"
        
        echo -e "\n${YELLOW}📋 IMPORTANT: You need to validate the certificate via DNS${NC}"
        echo "Run the following command to get the validation records:"
        echo "aws acm describe-certificate --certificate-arn ${CERT_ARN} --region us-east-1"
        echo ""
        echo "Add the CNAME records to your DNS (Route53 or other DNS provider)"
        echo "The deployment script will wait for certificate validation."
    fi
    
    # Save certificate ARN for later use
    echo "$CERT_ARN" > ".aws-cert-arn-${ENVIRONMENT}.txt"
}

# Function to create CloudFront distribution
create_cloudfront_distribution() {
    echo -e "\n${YELLOW}☁️  Creating CloudFront distribution${NC}"
    echo -e "${YELLOW}⚠️  This is a placeholder - actual distribution will be created after OpenNext build${NC}"
    
    # The actual CloudFront distribution should be created after the OpenNext build
    # because OpenNext generates specific configuration for Lambda@Edge functions
    # See the deployment script for the actual CloudFront creation
    
    echo -e "${GREEN}✅ CloudFront setup will be completed during deployment${NC}"
}

# Function to create IAM role for deployment
create_deployment_user() {
    echo -e "\n${YELLOW}👤 Creating IAM deployment user/role${NC}"
    
    USER_NAME="${PROJECT_NAME}-deployer"
    
    # Check if user already exists
    if aws iam get-user --user-name "${USER_NAME}" &> /dev/null; then
        echo -e "${YELLOW}⚠️  IAM user already exists: ${USER_NAME}${NC}"
    else
        aws iam create-user --user-name "${USER_NAME}"
        echo -e "${GREEN}✅ IAM user created: ${USER_NAME}${NC}"
    fi
    
    # Create and attach policy
    POLICY_NAME="${PROJECT_NAME}-deployment-policy"
    
    cat > /tmp/deployment-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::${PROJECT_NAME}-*",
                "arn:aws:s3:::${PROJECT_NAME}-*/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:CreateInvalidation",
                "cloudfront:GetInvalidation",
                "cloudfront:ListInvalidations",
                "cloudfront:GetDistribution",
                "cloudfront:ListDistributions"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "lambda:UpdateFunctionCode",
                "lambda:GetFunction",
                "lambda:PublishVersion"
            ],
            "Resource": "arn:aws:lambda:*:*:function:${PROJECT_NAME}-*"
        }
    ]
}
EOF
    
    # Create or update policy
    POLICY_ARN=$(aws iam list-policies --scope Local \
        --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" --output text)
    
    if [ -n "$POLICY_ARN" ]; then
        echo -e "${YELLOW}⚠️  Policy already exists, updating...${NC}"
        # Delete old versions if needed (AWS has a limit of 5 versions)
        VERSIONS=$(aws iam list-policy-versions --policy-arn "${POLICY_ARN}" \
            --query "Versions[?IsDefaultVersion==\`false\`].VersionId" --output text)
        for VERSION in $VERSIONS; do
            aws iam delete-policy-version --policy-arn "${POLICY_ARN}" --version-id "${VERSION}"
        done
        aws iam create-policy-version --policy-arn "${POLICY_ARN}" \
            --policy-document file:///tmp/deployment-policy.json --set-as-default
    else
        POLICY_RESULT=$(aws iam create-policy \
            --policy-name "${POLICY_NAME}" \
            --policy-document file:///tmp/deployment-policy.json)
        POLICY_ARN=$(echo "$POLICY_RESULT" | jq -r '.Policy.Arn')
    fi
    
    # Attach policy to user
    aws iam attach-user-policy \
        --user-name "${USER_NAME}" \
        --policy-arn "${POLICY_ARN}"
    
    echo -e "${GREEN}✅ IAM policy attached${NC}"
    rm /tmp/deployment-policy.json
    
    echo -e "\n${YELLOW}📋 To create access keys for CI/CD:${NC}"
    echo "aws iam create-access-key --user-name ${USER_NAME}"
}

# Main execution
main() {
    echo -e "${GREEN}Starting AWS infrastructure setup...${NC}\n"
    
    check_aws_cli
    check_aws_credentials
    create_s3_bucket
    create_oai
    request_certificate
    create_cloudfront_distribution
    create_deployment_user
    
    echo -e "\n${GREEN}✅ Infrastructure setup complete!${NC}"
    echo -e "\n${YELLOW}📋 Next steps:${NC}"
    echo "1. Validate your ACM certificate via DNS"
    echo "2. Install dependencies: npm install"
    echo "3. Build with OpenNext: npm run build:open-next"
    echo "4. Deploy to AWS: ./scripts/deploy-to-aws.sh ${ENVIRONMENT}"
    echo ""
    echo "Configuration saved to:"
    echo "  - Certificate ARN: .aws-cert-arn-${ENVIRONMENT}.txt"
}

main
