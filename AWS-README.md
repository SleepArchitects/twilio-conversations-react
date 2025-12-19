# AWS Deployment - START HERE 🚀

**Last Updated**: December 17, 2025

---

## 📍 You Are Here

This project is **ready for AWS deployment** using OpenNext, but requires **one-time manual infrastructure setup** before the first deployment.

---

## 🎯 Quick Start

### First Time Deployer?

**Follow these documents in order:**

1. **[AWS-DEPLOYMENT-REVIEW.md](./AWS-DEPLOYMENT-REVIEW.md)** - Read this first
   - Executive summary
   - What's ready vs what needs setup
   - Risk assessment and timeline

2. **[AWS-PRE-DEPLOYMENT-SETUP.md](./AWS-PRE-DEPLOYMENT-SETUP.md)** - Complete all steps
   - Step-by-step infrastructure setup
   - Copy-paste commands provided
   - Estimated time: 1-2 hours

3. **[AWS-QUICK-REFERENCE.md](./AWS-QUICK-REFERENCE.md)** - Keep this handy
   - Quick command reference
   - Troubleshooting guide
   - Daily deployment commands

### Already Set Up?

```bash
# Build and deploy
npm run build:open-next
node scripts/deploy-outreach.cjs develop

# Or just deploy (via CI/CD)
git push origin main
```

---

## 📚 Documentation Index

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[AWS-DEPLOYMENT-REVIEW.md](./AWS-DEPLOYMENT-REVIEW.md)** | Comprehensive review, findings, go/no-go | Before starting |
| **[AWS-PRE-DEPLOYMENT-SETUP.md](./AWS-PRE-DEPLOYMENT-SETUP.md)** | Infrastructure setup steps | First time only |
| **[AWS-QUICK-REFERENCE.md](./AWS-QUICK-REFERENCE.md)** | Quick commands and troubleshooting | Daily use |
| **[AWS-DEPLOYMENT-GUIDE.md](./AWS-DEPLOYMENT-GUIDE.md)** | Complete deployment guide | Reference |
| **[AWS-DEPLOYMENT-ARCHITECTURE.md](./AWS-DEPLOYMENT-ARCHITECTURE.md)** | Architecture deep dive | For understanding |
| **[DEPLOYMENT-HANDOVER.md](./DEPLOYMENT-HANDOVER.md)** | Multi-zone integration | SleepConnect context |

---

## ⚡ TL;DR

### What's Been Done ✅
- OpenNext configured and ready
- Deployment script (`deploy-outreach.cjs`) working
- CI/CD pipeline configured
- Environment variables documented
- All code reviewed and validated

### What You Need to Do ⏳
1. Create AWS resources (S3, Lambda, IAM) - **1 hour**
2. Update SleepConnect CloudFront - **30 minutes**
3. Deploy for first time - **20 minutes**
4. Test and verify - **30 minutes**

**Total Time**: ~2-3 hours for first deployment

---

## 🎬 Step-by-Step First Deployment

### Step 1: Read the Review (5 min)
```bash
open AWS-DEPLOYMENT-REVIEW.md
```

### Step 2: Complete Infrastructure Setup (1-2 hours)
```bash
open AWS-PRE-DEPLOYMENT-SETUP.md
# Follow all 10 steps exactly
```

### Step 3: Deploy (20 min)
```bash
npm install
npm run build:open-next
node scripts/deploy-outreach.cjs develop
```

### Step 4: Verify (30 min)
```bash
# Test Lambda directly
curl $(cat .outreach-lambda-url-develop.txt)

# Test via multi-zone
open https://dev.mydreamconnect.com/outreach

# Check logs
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow
```

---

## ⚠️ Important Notes

### Use the Right Script ✅
- **✅ USE**: `node scripts/deploy-outreach.cjs`
- **❌ DON'T USE**: `./scripts/setup-aws-infrastructure.sh`
- **❌ DON'T USE**: `./scripts/deploy-to-aws.sh`

The bash scripts are **reference documentation only**. The Node.js script is the correct implementation.

### Multi-Zone Deployment
This app runs at:
- ✅ `dev.mydreamconnect.com/outreach` (correct)
- ❌ `outreach.mydreamconnect.com` (not standalone)

It integrates with SleepConnect's CloudFront distribution.

### Backend API Required
The frontend depends on a backend API Gateway being deployed at:
- REST API: `https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev`
- WebSocket: `wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev`

Verify it's accessible before deploying frontend.

---

## 🔑 Required Secrets

Before deploying, ensure you have:

### Build-Time (in `.env.local`)
```bash
NEXT_PUBLIC_APP_BASE_URL=https://dev.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_WS_API_URL=wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_BASE_PATH=/outreach
```

### Runtime (Lambda environment)
```bash
AUTH0_CLIENT_SECRET=***
AUTH0_CLIENT_ID=***
AUTH0_DOMAIN=***.auth0.com
TWILIO_ACCOUNT_SID=***
TWILIO_AUTH_TOKEN=***
TWILIO_MESSAGING_SERVICE_SID=***
```

See [.env.example](./.env.example) for complete list.

---

## 🆘 Need Help?

### Something Not Working?
1. Check [AWS-QUICK-REFERENCE.md](./AWS-QUICK-REFERENCE.md) troubleshooting section
2. Review CloudWatch Logs
3. Verify all pre-deployment steps completed
4. Check environment variables are set

### Questions About Architecture?
- Read [AWS-DEPLOYMENT-ARCHITECTURE.md](./AWS-DEPLOYMENT-ARCHITECTURE.md)
- Review [DEPLOYMENT-HANDOVER.md](./DEPLOYMENT-HANDOVER.md)

### Want More Details?
- See [AWS-DEPLOYMENT-GUIDE.md](./AWS-DEPLOYMENT-GUIDE.md)

---

## ✅ Pre-Flight Checklist

Before your first deployment:

- [ ] Read [AWS-DEPLOYMENT-REVIEW.md](./AWS-DEPLOYMENT-REVIEW.md)
- [ ] AWS CLI installed and configured
- [ ] S3 bucket created
- [ ] Lambda function created
- [ ] Lambda Function URL created
- [ ] Lambda environment variables set
- [ ] GitHub Secrets configured
- [ ] SleepConnect CloudFront updated
- [ ] SleepConnect redeployed with OUTREACH_APP_URL
- [ ] Backend API verified accessible
- [ ] `.env.local` configured
- [ ] Dependencies installed (`npm install`)

---

## 🚀 Ready to Deploy?

If all checklist items are complete:

```bash
# Build
npm run build:open-next

# Deploy to develop
node scripts/deploy-outreach.cjs develop

# Test
open https://dev.mydreamconnect.com/outreach
```

---

**Good luck! 🎉**

For questions, check the documentation or review CloudWatch Logs for debugging.
