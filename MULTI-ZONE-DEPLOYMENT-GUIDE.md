# Multi-Zone Deployment Guide: SMS Outreach Integration

**Date**: December 16, 2025  
**Status**: Ready for Implementation  
**Environment**: Development → Production

---

## 📋 Current Setup Summary

### ✅ What's Already Configured

#### 1. **SleepConnect Multi-Zone Rewrites** (Already Implemented)
- **Location**: `~/code/SAX/sleepconnect/next.config.js`
- **Configuration**:
  ```javascript
  async rewrites() {
    const outreachUrl = process.env.OUTREACH_APP_URL || 'http://localhost:3001';
    return {
      beforeFiles: [
        {
          source: '/outreach/:path*',
          destination: `${outreachUrl}/outreach/:path*`,
        },
      ],
    };
  }
  ```

#### 2. **Outreach App Configuration** (Already Set)
- **Location**: `~/code/SAX/twilio-conversations-react/next.config.mjs`
- **Settings**:
  - `basePath: "/outreach"`
  - `assetPrefix: "/outreach-static"` (production) or `"/outreach"` (dev)
  - `output: "standalone"`

#### 3. **AWS Infrastructure** (Already Deployed)
- **REST API**: `0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev`
- **WebSocket API**: `vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev`
- **Lambda Functions**: 18 functions deployed (see `deploy-all.sh`)
- **Database**: RDS PostgreSQL `SAXDBDEV` at `saxdb-dev.cyz24s0mmh72.us-east-1.rds.amazonaws.com`

#### 4. **Environment File** (Just Created)
- **Location**: `~/code/SAX/twilio-conversations-react/.env.local`
- **Configured for**: Local development with localhost:3001 (outreach) and localhost:3000 (sleepconnect)

---

## 🎯 Deployment Architecture

### Local Development Setup
```
┌─────────────────────────────────────────────────┐
│ SleepConnect (localhost:3000)                   │
│ - Runs on port 3000                             │
│ - Rewrites /outreach/* → localhost:3001/outreach│
│ - Provides JWT auth context                     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ Outreach App (localhost:3001)                   │
│ - Runs on port 3001                             │
│ - basePath: /outreach                           │
│ - Validates JWT from x-sax-user-context cookie  │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ AWS Backend                                     │
│ - REST API: 0qz7d63vw2...amazonaws.com/dev     │
│ - WebSocket: vfb5l5uxak...amazonaws.com/dev    │
└─────────────────────────────────────────────────┘
```

### Production Multi-Zone Setup
```
User: https://dev.mydreamconnect.com/outreach/conversations
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ SleepConnect (dev.mydreamconnect.com)           │
│ - Intercepts /outreach/* requests via rewrites  │
│ - Proxies to outreach.mydreamconnect.com        │
│ - Injects JWT via x-sax-user-context cookie     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ Outreach Zone (outreach.mydreamconnect.com)     │
│ - basePath: /outreach                           │
│ - assetPrefix: /outreach-static                 │
│ - Validates JWT token                           │
│ - Serves content without SleepConnect shell     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ API Backend (outreach-api.mydreamconnect.com)   │
│ - REST API endpoints                            │
│ - WebSocket connections                         │
│ - Lambda functions                              │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Steps

### Phase 1: Local Development Testing

#### Step 1.1: Verify Environment Variables
```bash
cd ~/code/SAX/twilio-conversations-react

# Check .env.local exists and has correct values
cat .env.local | grep -E "APP_BASE_URL|SLEEPCONNECT_URL|API_BASE_URL"
```

**Expected Output**:
```
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SLEEPCONNECT_URL=http://localhost:3000
API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
```

#### Step 1.2: Start SleepConnect (Terminal 1)
```bash
cd ~/code/SAX/sleepconnect
npm run dev
# Should start on port 3000
```

#### Step 1.3: Start Outreach App (Terminal 2)
```bash
cd ~/code/SAX/twilio-conversations-react
npm run dev -- -p 3001
# Should start on port 3001
```

#### Step 1.4: Test Multi-Zone Access
```bash
# Test direct access to Outreach
curl -I http://localhost:3001/outreach

# Test proxied access through SleepConnect
curl -I http://localhost:3000/outreach

# Open in browser
open http://localhost:3000/outreach/conversations
```

---

### Phase 2: AWS Custom Domain Setup

#### Step 2.1: Create Custom Domain for API Gateway

**Create Certificate in ACM** (if not exists):
```bash
# Request certificate for *.mydreamconnect.com
aws acm request-certificate \
  --domain-name "*.mydreamconnect.com" \
  --subject-alternative-names "mydreamconnect.com" \
  --validation-method DNS \
  --region us-east-1
```

**Create Custom Domain for REST API**:
```bash
# Get certificate ARN
CERT_ARN=$(aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='*.mydreamconnect.com'].CertificateArn" \
  --output text)

# Create custom domain
aws apigateway create-domain-name \
  --domain-name "outreach-api.mydreamconnect.com" \
  --regional-certificate-arn "$CERT_ARN" \
  --endpoint-configuration types=REGIONAL \
  --region us-east-1

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name "outreach-api.mydreamconnect.com" \
  --rest-api-id "0qz7d63vw2" \
  --stage "dev" \
  --region us-east-1
```

**Create Custom Domain for WebSocket API**:
```bash
aws apigatewayv2 create-domain-name \
  --domain-name "outreach-api.mydreamconnect.com" \
  --domain-name-configurations CertificateArn="$CERT_ARN" \
  --region us-east-1

aws apigatewayv2 create-api-mapping \
  --domain-name "outreach-api.mydreamconnect.com" \
  --api-id "vfb5l5uxak" \
  --stage "dev" \
  --region us-east-1
```

#### Step 2.2: Update Route53 DNS

```bash
# Get hosted zone ID for mydreamconnect.com
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='mydreamconnect.com.'].Id" \
  --output text | cut -d'/' -f3)

# Get API Gateway regional domain
API_DOMAIN=$(aws apigateway get-domain-name \
  --domain-name "outreach-api.mydreamconnect.com" \
  --region us-east-1 \
  --query "regionalDomainName" \
  --output text)

# Create A record for outreach-api.mydreamconnect.com
cat > /tmp/route53-outreach-api.json <<EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "outreach-api.mydreamconnect.com",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z1UJRXOUMOOFQ8",
        "DNSName": "$API_DOMAIN",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/route53-outreach-api.json
```

#### Step 2.3: Test Custom Domain

```bash
# Test REST API
curl https://outreach-api.mydreamconnect.com/outreach/conversations

# Test WebSocket API
wscat -c wss://outreach-api.mydreamconnect.com
```

---

### Phase 3: Production Deployment

#### Step 3.1: Create Production Environment File

Create `.env.production` with production values:

```bash
cd ~/code/SAX/twilio-conversations-react

cat > .env.production <<'EOF'
# Production Environment Variables
NODE_ENV=production

# Authentication
DISABLE_AUTH=false
MULTI_ZONE_MODE=true
AUTH0_DOMAIN=sleeparchitects.us.auth0.com
AUTH0_CLIENT_ID=your-production-client-id
AUTH0_CLIENT_SECRET=your-production-client-secret
AUTH0_BASE_URL=https://dev.mydreamconnect.com

# Application URLs
NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com
NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com
NEXT_PUBLIC_BASE_PATH=/outreach

# API Configuration
API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_WS_API_URL=wss://outreach-api.mydreamconnect.com

# Twilio (from AWS Secrets Manager or secure env)
TWILIO_ACCOUNT_SID=<your-account-sid>
TWILIO_SID=<your-account-sid>
TWILIO_AUTH_TOKEN=<your-auth-token>
TWILIO_FROM_NUMBER=<your-twilio-phone>

# Feature Flags
ENABLE_SLA_MONITORING=true
NEXT_PUBLIC_ENABLE_SLA_MONITORING=true
ALLOW_INTERNATIONAL_PHONES=false

# Branding
NEXT_PUBLIC_PRACTICE_NAME=Sleep Architects
NEXT_PUBLIC_SHOW_BANNER=false
EOF
```

#### Step 3.2: Build and Deploy

**Option A: Deploy to Vercel**:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod \
  --build-env NODE_ENV=production \
  --env-file .env.production

# Configure custom domain in Vercel dashboard:
# outreach.mydreamconnect.com
```

**Option B: Deploy to AWS (OpenNext)**:
```bash
# Install OpenNext
npm install -g open-next

# Build
npm run build

# Package with OpenNext
open-next build

# Deploy to AWS Lambda + CloudFront
# (requires additional CDK/Terraform setup)
```

#### Step 3.3: Update SleepConnect Environment

Add to SleepConnect's `.env.production`:
```bash
OUTREACH_APP_URL=https://outreach.mydreamconnect.com
```

Redeploy SleepConnect to enable production multi-zone rewrites.

---

### Phase 4: Verification & Testing

#### Step 4.1: Health Checks

```bash
# Check Outreach standalone
curl -I https://outreach.mydreamconnect.com/outreach

# Check multi-zone proxied access
curl -I https://dev.mydreamconnect.com/outreach

# Check API
curl https://outreach-api.mydreamconnect.com/outreach/conversations

# Check WebSocket
wscat -c wss://outreach-api.mydreamconnect.com
```

#### Step 4.2: End-to-End Test

1. **Login Flow**:
   - Navigate to `https://dev.mydreamconnect.com/outreach`
   - Should redirect to Auth0 if not logged in
   - After login, should see conversations list

2. **JWT Token Validation**:
   - Open browser DevTools → Application → Cookies
   - Verify `x-sax-user-context` cookie exists
   - Verify JWT signature is valid

3. **Real-Time Updates**:
   - Open two browser windows
   - Send message in one window
   - Verify message appears in other window via WebSocket

4. **SLA Monitoring**:
   - Send inbound SMS to Twilio number
   - Check conversation shows "Warning" status
   - Send response
   - Verify status changes to "OK"

---

## 🔧 Environment Variable Reference

### Required for All Environments

| Variable | Description | Example |
|----------|-------------|---------|
| `DISABLE_AUTH` | Disable auth (dev only) | `false` |
| `MULTI_ZONE_MODE` | Enable multi-zone | `true` |
| `AUTH0_CLIENT_SECRET` | JWT signing secret | `<secret>` |
| `NEXT_PUBLIC_APP_BASE_URL` | This app's URL | `https://outreach.mydreamconnect.com` |
| `NEXT_PUBLIC_SLEEPCONNECT_URL` | SleepConnect URL | `https://dev.mydreamconnect.com` |
| `API_BASE_URL` | Backend API | `https://outreach-api.mydreamconnect.com` |
| `NEXT_PUBLIC_WS_API_URL` | WebSocket API | `wss://outreach-api.mydreamconnect.com` |

### Local Development Overrides

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_BASE_URL` | `http://localhost:3001` |
| `NEXT_PUBLIC_SLEEPCONNECT_URL` | `http://localhost:3000` |
| `API_BASE_URL` | `https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev` |
| `NEXT_PUBLIC_WS_API_URL` | `wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev` |

---

## 🐛 Troubleshooting

### Issue: 404 on CSS/JS files

**Symptom**: Browser shows 404 for `/_next/static/...` files

**Cause**: `assetPrefix` misconfiguration

**Solution**:
```javascript
// next.config.mjs
assetPrefix: process.env.NODE_ENV === "production" 
  ? "/outreach-static"  // CloudFront path
  : "/outreach",         // Local dev
```

### Issue: Redirect loop on login

**Symptom**: Browser keeps redirecting between SleepConnect and Outreach

**Cause**: JWT cookie not being set/forwarded correctly

**Solution**:
1. Check SleepConnect middleware forwards `x-sax-user-context` cookie
2. Verify cookie domain is set to `.mydreamconnect.com` (with leading dot)
3. Check cookie `sameSite` and `secure` settings

### Issue: WebSocket connection fails

**Symptom**: Real-time messages not appearing

**Solution**:
```bash
# Check WebSocket API is accessible
wscat -c $NEXT_PUBLIC_WS_API_URL

# Check Lambda has WS_API_ENDPOINT env var
aws lambda get-function-configuration \
  --function-name sax-lam-us-east-1-1x-p-0x-sms-ws-send-msg \
  --region us-east-1 \
  --query 'Environment.Variables.WS_API_ENDPOINT'
```

### Issue: CORS errors

**Symptom**: API calls blocked by browser

**Solution**:
1. Check API Gateway CORS configuration
2. Verify `Access-Control-Allow-Origin` includes both domains
3. Check preflight OPTIONS requests return 200

---

## 📊 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Local testing complete (localhost:3000 + localhost:3001)
- [ ] AWS Lambda functions deployed and tested
- [ ] Database migrations applied
- [ ] Auth0 callback URLs configured

### AWS Infrastructure
- [ ] ACM certificate issued for `*.mydreamconnect.com`
- [ ] Custom domain `outreach-api.mydreamconnect.com` created
- [ ] Route53 DNS records updated
- [ ] API Gateway custom domain mapped
- [ ] WebSocket API custom domain mapped

### Application Deployment
- [ ] `.env.production` file created with production values
- [ ] Next.js build successful
- [ ] Deployed to hosting (Vercel/AWS)
- [ ] Custom domain `outreach.mydreamconnect.com` configured
- [ ] CloudFront/CDN configured for static assets

### SleepConnect Integration
- [ ] `OUTREACH_APP_URL` environment variable set
- [ ] Multi-zone rewrites configured
- [ ] JWT cookie forwarding implemented
- [ ] SleepConnect redeployed with changes

### Testing & Validation
- [ ] Health checks passing
- [ ] Login flow working
- [ ] JWT validation working
- [ ] Real-time WebSocket updates working
- [ ] SLA monitoring functional
- [ ] Mobile responsive
- [ ] Performance acceptable

### Post-Deployment
- [ ] Monitor CloudWatch logs
- [ ] Set up alerts for errors
- [ ] Document any issues
- [ ] Update team documentation

---

## 📞 Support Resources

### AWS Resources
- **REST API**: `0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev`
- **WebSocket API**: `vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev`
- **Database**: `saxdb-dev.cyz24s0mmh72.us-east-1.rds.amazonaws.com:5432/SAXDBDEV`

### Documentation
- **Deployment Handover**: `DEPLOYMENT-HANDOVER.md`
- **SLA Implementation**: `~/code/SAX/sleepconnect/lambdas/lambda-sms-outreach/SLA-IMPLEMENTATION-COMPLETE.md`
- **Lambda Deploy Scripts**: `~/code/SAX/sleepconnect/lambdas/lambda-sms-outreach/`

### Key Files
- **Outreach Config**: `~/code/SAX/twilio-conversations-react/next.config.mjs`
- **SleepConnect Config**: `~/code/SAX/sleepconnect/next.config.js`
- **Middleware**: `~/code/SAX/twilio-conversations-react/middleware.ts`

---

**Document Status**: Complete and Ready for Implementation  
**Last Updated**: December 16, 2025  
**Next Steps**: Begin Phase 1 (Local Development Testing)
