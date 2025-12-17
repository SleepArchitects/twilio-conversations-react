#!/bin/bash

# AWS Deployment Script for SMS Outreach (OpenNext)
# This script deploys the OpenNext build to AWS Lambda, S3, and CloudFront
# Prerequisites: 
#   - AWS CLI installed and configured
#   - OpenNext build completed (npm run build:open-next)
#   - Infrastructure setup completed (./scripts/setup-aws-infrastructure.sh)

set -e  # Exit on any error

# Configuration
PROJECT_NAME="outreach-mydreamconnect"
REGION="us-east-1"
DOMAIN="outreach.mydreamconnect.com"
ENVIRONMENT="${1:-production}"

# Validate environment parameter
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|dev)$ ]]; then
    echo "❌ Invalid environment. Use: production, staging, or dev"
    exit 1
fi

echo "🚀 Deploying ${PROJECT_NAME} to AWS (${ENVIRONMENT})"
echo "Region: ${REGION}"
echo "Domain: ${DOMAIN}"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BUCKET_NAME="${PROJECT_NAME}-${ENVIRONMENT}"
OPEN_NEXT_DIR=".open-next"
BUILD_ID=$(date +%Y%m%d-%H%M%S)

# Function to check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed${NC}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured${NC}"
        exit 1
    fi
    
    # Check if OpenNext build exists
    if [ ! -d "$OPEN_NEXT_DIR" ]; then
        echo -e "${RED}❌ OpenNext build not found. Run: npm run build:open-next${NC}"
        exit 1
    fi
    
    # Check if S3 bucket exists
    if ! aws s3 ls "s3://${BUCKET_NAME}" &> /dev/null; then
        echo -e "${RED}❌ S3 bucket ${BUCKET_NAME} not found${NC}"
        echo "Run: ./scripts/setup-aws-infrastructure.sh ${ENVIRONMENT}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Function to deploy static assets to S3
deploy_static_assets() {
    echo -e "\n${BLUE}📦 Deploying static assets to S3...${NC}"
    
    # OpenNext puts static assets in .open-next/assets
    if [ -d "${OPEN_NEXT_DIR}/assets" ]; then
        # Upload with proper cache headers
        aws s3 sync "${OPEN_NEXT_DIR}/assets/" "s3://${BUCKET_NAME}/outreach-static/" \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --metadata "build-id=${BUILD_ID}"
        
        echo -e "${GREEN}✅ Static assets deployed${NC}"
    else
        echo -e "${YELLOW}⚠️  No static assets found in ${OPEN_NEXT_DIR}/assets${NC}"
    fi
}

# Function to create or update Lambda function
deploy_server_function() {
    echo -e "\n${BLUE}⚡ Deploying server Lambda function...${NC}"
    
    FUNCTION_NAME="${PROJECT_NAME}-server-${ENVIRONMENT}"
    SERVER_ZIP="${OPEN_NEXT_DIR}/server-function/index.zip"
    
    # Check if the server function zip exists
    if [ ! -f "$SERVER_ZIP" ]; then
        # OpenNext might put it in a different location
        SERVER_ZIP="${OPEN_NEXT_DIR}/server-function.zip"
    fi
    
    if [ ! -f "$SERVER_ZIP" ]; then
        echo -e "${YELLOW}⚠️  Creating Lambda deployment package from server-function...${NC}"
        
        # Create zip from the server-function directory
        cd "${OPEN_NEXT_DIR}/server-function" || exit 1
        zip -r ../server-function.zip . -x "*.git*" "node_modules/.cache/*"
        cd - > /dev/null
        
        SERVER_ZIP="${OPEN_NEXT_DIR}/server-function.zip"
    fi
    
    # Check if function exists
    if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" &> /dev/null; then
        echo -e "${YELLOW}Updating existing Lambda function...${NC}"
        
        aws lambda update-function-code \
            --function-name "${FUNCTION_NAME}" \
            --zip-file "fileb://${SERVER_ZIP}" \
            --region "${REGION}" \
            --publish > /dev/null
        
        echo -e "${GREEN}✅ Lambda function updated${NC}"
    else
        echo -e "${YELLOW}Creating new Lambda function...${NC}"
        
        # Get or create Lambda execution role
        ROLE_NAME="${PROJECT_NAME}-lambda-role"
        ROLE_ARN=$(get_or_create_lambda_role)
        
        aws lambda create-function \
            --function-name "${FUNCTION_NAME}" \
            --runtime nodejs18.x \
            --role "${ROLE_ARN}" \
            --handler index.handler \
            --zip-file "fileb://${SERVER_ZIP}" \
            --timeout 30 \
            --memory-size 1024 \
            --region "${REGION}" \
            --environment "Variables={NODE_ENV=production,ENVIRONMENT=${ENVIRONMENT}}" \
            --publish > /dev/null
        
        echo -e "${GREEN}✅ Lambda function created${NC}"
    fi
    
    # Get the function ARN for CloudFront
    LAMBDA_ARN=$(aws lambda get-function \
        --function-name "${FUNCTION_NAME}" \
        --region "${REGION}" \
        --query 'Configuration.FunctionArn' \
        --output text)
    
    echo "Lambda ARN: ${LAMBDA_ARN}"
    echo "${LAMBDA_ARN}" > ".aws-lambda-arn-${ENVIRONMENT}.txt"
}

# Function to deploy image optimization function (if exists)
deploy_image_optimization() {
    echo -e "\n${BLUE}🖼️  Checking for image optimization function...${NC}"
    
    IMAGE_ZIP="${OPEN_NEXT_DIR}/image-optimization-function.zip"
    
    if [ ! -f "$IMAGE_ZIP" ]; then
        echo -e "${YELLOW}⚠️  No image optimization function found (optional)${NC}"
        return
    fi
    
    FUNCTION_NAME="${PROJECT_NAME}-image-${ENVIRONMENT}"
    
    # Similar deployment process as server function
    if aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${REGION}" &> /dev/null; then
        aws lambda update-function-code \
            --function-name "${FUNCTION_NAME}" \
            --zip-file "fileb://${IMAGE_ZIP}" \
            --region "${REGION}" \
            --publish > /dev/null
        
        echo -e "${GREEN}✅ Image optimization function updated${NC}"
    else
        ROLE_ARN=$(get_or_create_lambda_role)
        
        aws lambda create-function \
            --function-name "${FUNCTION_NAME}" \
            --runtime nodejs18.x \
            --role "${ROLE_ARN}" \
            --handler index.handler \
            --zip-file "fileb://${IMAGE_ZIP}" \
            --timeout 30 \
            --memory-size 1536 \
            --region "${REGION}" \
            --publish > /dev/null
        
        echo -e "${GREEN}✅ Image optimization function created${NC}"
    fi
}

# Function to get or create Lambda execution role
get_or_create_lambda_role() {
    ROLE_NAME="${PROJECT_NAME}-lambda-role"
    
    # Check if role exists
    if aws iam get-role --role-name "${ROLE_NAME}" &> /dev/null; then
        aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text
        return
    fi
    
    # Create trust policy
    cat > /tmp/lambda-trust-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": [
                    "lambda.amazonaws.com",
                    "edgelambda.amazonaws.com"
                ]
            },
            "Action": "sts:AssumeRole"
        }
    ]
}
EOF
    
    # Create role
    ROLE_ARN=$(aws iam create-role \
        --role-name "${ROLE_NAME}" \
        --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
        --query 'Role.Arn' \
        --output text)
    
    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name "${ROLE_NAME}" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    
    # Wait for role to be available
    sleep 10
    
    rm /tmp/lambda-trust-policy.json
    echo "$ROLE_ARN"
}

# Function to create/update CloudFront distribution
deploy_cloudfront() {
    echo -e "\n${BLUE}☁️  Setting up CloudFront distribution...${NC}"
    
    # Check if certificate is validated
    if [ ! -f ".aws-cert-arn-${ENVIRONMENT}.txt" ]; then
        echo -e "${RED}❌ Certificate ARN not found${NC}"
        echo "Run: ./scripts/setup-aws-infrastructure.sh ${ENVIRONMENT}"
        exit 1
    fi
    
    CERT_ARN=$(cat ".aws-cert-arn-${ENVIRONMENT}.txt")
    
    # Check certificate status
    CERT_STATUS=$(aws acm describe-certificate \
        --certificate-arn "${CERT_ARN}" \
        --region us-east-1 \
        --query 'Certificate.Status' \
        --output text)
    
    if [ "$CERT_STATUS" != "ISSUED" ]; then
        echo -e "${RED}❌ Certificate is not validated yet (Status: ${CERT_STATUS})${NC}"
        echo "Please validate the certificate in ACM before deploying CloudFront"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Certificate is validated${NC}"
    
    # For now, save the configuration for manual CloudFront setup
    # Full automated CloudFront + Lambda@Edge setup is complex and should be done with IaC
    cat > ".aws-cloudfront-config-${ENVIRONMENT}.json" <<EOF
{
    "domain": "${DOMAIN}",
    "certificate_arn": "${CERT_ARN}",
    "s3_bucket": "${BUCKET_NAME}",
    "lambda_function": "$(cat .aws-lambda-arn-${ENVIRONMENT}.txt)",
    "base_path": "/outreach",
    "asset_prefix": "/outreach-static"
}
EOF
    
    echo -e "${YELLOW}⚠️  CloudFront distribution setup should be done with IaC (CDK/Terraform)${NC}"
    echo "Configuration saved to: .aws-cloudfront-config-${ENVIRONMENT}.json"
}

# Function to invalidate CloudFront cache
invalidate_cloudfront() {
    echo -e "\n${BLUE}🔄 Checking for CloudFront distribution...${NC}"
    
    # Find distribution by tag or alias
    DIST_ID=$(aws cloudfront list-distributions \
        --query "DistributionList.Items[?Aliases.Items[?@=='${DOMAIN}']].Id" \
        --output text)
    
    if [ -z "$DIST_ID" ]; then
        echo -e "${YELLOW}⚠️  No CloudFront distribution found for ${DOMAIN}${NC}"
        echo "Create the distribution first, then run this script again"
        return
    fi
    
    echo -e "${YELLOW}Creating CloudFront invalidation...${NC}"
    
    aws cloudfront create-invalidation \
        --distribution-id "${DIST_ID}" \
        --paths "/outreach/*" "/outreach-static/*" > /dev/null
    
    echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
}

# Function to create deployment summary
create_deployment_summary() {
    echo -e "\n${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Deployment Summary${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "Environment: ${ENVIRONMENT}"
    echo -e "Build ID: ${BUILD_ID}"
    echo -e "S3 Bucket: s3://${BUCKET_NAME}"
    
    if [ -f ".aws-lambda-arn-${ENVIRONMENT}.txt" ]; then
        echo -e "Lambda Function: $(cat .aws-lambda-arn-${ENVIRONMENT}.txt)"
    fi
    
    if [ -f ".aws-cloudfront-config-${ENVIRONMENT}.json" ]; then
        echo -e "CloudFront Config: .aws-cloudfront-config-${ENVIRONMENT}.json"
    fi
    
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📋 Next steps:${NC}"
    echo "1. Set up CloudFront distribution (manual or IaC)"
    echo "2. Configure Route53 to point to CloudFront"
    echo "3. Test the deployment: https://${DOMAIN}/outreach"
    echo ""
}

# Main execution
main() {
    echo -e "${GREEN}Starting deployment...${NC}\n"
    
    check_prerequisites
    deploy_static_assets
    deploy_server_function
    deploy_image_optimization
    deploy_cloudfront
    invalidate_cloudfront
    create_deployment_summary
    
    echo -e "${GREEN}✅ Deployment complete!${NC}"
}

main
