# Local Development Quick Start Guide

**Date**: December 16, 2025  
**Setup**: Multi-Zone Local Development

---

## 🎯 Overview

This guide helps you run **SleepConnect** (port 3000) and **SMS Outreach** (port 3001) together in multi-zone mode for local development.

---

## ✅ Prerequisites

### Required Software

- Node.js 18+ (check: `node -v`)
- npm or pnpm (check: `npm -v` or `pnpm -v`)
- AWS CLI configured (check: `aws sts get-caller-identity`)

### Environment Files Created

- ✅ `~/code/SAX/sleepconnect/.env.local` (port 3000)
- ✅ `~/code/SAX/twilio-conversations-react/.env.local` (port 3001)

---

## 🚀 Quick Start

### Terminal 1: Start SleepConnect

```bash
cd ~/code/SAX/sleepconnect

# Install dependencies (if needed)
npm install

# Start on port 3000
npm run dev

# Expected output:
# ✓ Ready on http://localhost:3000
```

### Terminal 2: Start SMS Outreach

```bash
cd ~/code/SAX/twilio-conversations-react

# Install dependencies (if needed)
npm install

# Start on port 3001
npm run dev -- -p 3001

# Expected output:
# ✓ Ready on http://localhost:3001
```

---

## 🧪 Testing the Setup

### 1. Test Direct Access to Outreach

```bash
# Should return 200 OK
curl -I http://localhost:3001/outreach
```

### 2. Test Multi-Zone Proxying

```bash
# SleepConnect should proxy /outreach/* to port 3001
curl -I http://localhost:3000/outreach
```

### 3. Open in Browser

**Multi-Zone Access (Recommended)**:

```bash
open http://localhost:3000/outreach/conversations
```

- Goes through SleepConnect first
- Auth0 authentication
- SleepConnect header/footer visible

**Standalone Access** (for debugging):

```bash
open http://localhost:3001/outreach/conversations
```

- Direct to Outreach app
- No SleepConnect wrapper
- Auth may not work without SleepConnect JWT

---

## 🔧 Configuration Summary

### SleepConnect (.env.local)

```bash
PORT=3000
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
AUTH0_BASE_URL=http://localhost:3000
OUTREACH_APP_URL=http://localhost:3001  # Multi-zone target
```

### SMS Outreach (.env.local)

```bash
# Port configured via CLI: npm run dev -- -p 3001
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001
NEXT_PUBLIC_SLEEPCONNECT_URL=http://localhost:3000
NEXT_PUBLIC_BASE_PATH=/outreach
```

### Multi-Zone Rewrite (already configured)

**File**: `sleepconnect/next.config.js`

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

---

## 🔐 Authentication Flow

### How it Works

1. User visits `http://localhost:3000/outreach`
2. SleepConnect middleware checks authentication
3. If not logged in → redirects to Auth0
4. After login → SleepConnect creates JWT
5. JWT stored in `x-sax-user-context` cookie
6. Request proxied to `http://localhost:3001/outreach`
7. Outreach validates JWT from cookie
8. User sees Outreach content with SleepConnect shell

### Debugging Auth Issues

```bash
# Check cookies in browser DevTools:
# - Application → Cookies → http://localhost:3000
# - Look for: x-sax-user-context

# Check JWT payload:
# Copy JWT from cookie, paste into https://jwt.io
```

---

## 🛠️ Common Issues & Solutions

### Issue 1: Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use different port
npm run dev -- -p 3002
```

### Issue 2: 404 on /outreach Routes

**Symptom**: Navigating to `localhost:3000/outreach` returns 404

**Solution**:

1. Check `OUTREACH_APP_URL` is set in SleepConnect `.env.local`
2. Verify Outreach is running on port 3001
3. Restart SleepConnect dev server

### Issue 3: CSS/JS Not Loading

**Symptom**: Page loads but styling is broken

**Solution**:

```bash
# Check next.config.mjs has correct assetPrefix
# For local dev, should be:
assetPrefix: process.env.NODE_ENV === "production" ? "/outreach-static" : "/outreach"

# Restart dev servers
```

### Issue 4: Authentication Loop

**Symptom**: Keeps redirecting between SleepConnect and Auth0

**Solution**:

1. Clear browser cookies for localhost
2. Check AUTH0_BASE_URL matches SleepConnect URL
3. Verify AUTH0_CLIENT_ID and SECRET match between both apps

### Issue 5: API Connection Errors

**Symptom**: "Failed to fetch" or CORS errors

**Solution**:

```bash
# Check API Gateway is accessible
curl https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev/outreach/conversations

# Check environment variables
grep API_BASE_URL ~/code/SAX/twilio-conversations-react/.env.local

# Verify AWS credentials
aws sts get-caller-identity
```

---

## 📊 Health Checks

### SleepConnect Health

```bash
curl http://localhost:3000/api/health
# or
curl http://localhost:3000
# Should return 200 OK
```

### Outreach Health

```bash
curl http://localhost:3001/outreach
# Should return 200 OK or HTML content
```

### API Gateway Health

```bash
# Test REST API
curl https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev/outreach/conversations

# Test WebSocket (requires wscat)
wscat -c wss://outreach-ws-dev.mydreamconnect.com
```

---

## 🧹 Cleanup & Reset

### Clear Node Modules

```bash
# SleepConnect
cd ~/code/SAX/sleepconnect
rm -rf node_modules .next
npm install

# Outreach
cd ~/code/SAX/twilio-conversations-react
rm -rf node_modules .next
npm install
```

### Clear Browser Data

1. Open DevTools (F12)
2. Application → Storage → Clear site data
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Reset Environment

```bash
# Backup current .env.local files
cp ~/code/SAX/sleepconnect/.env.local ~/code/SAX/sleepconnect/.env.local.backup
cp ~/code/SAX/twilio-conversations-react/.env.local ~/code/SAX/twilio-conversations-react/.env.local.backup

# Restore from this guide if needed
```

---

## 🔗 Useful Commands

### Check What's Running

```bash
# Check port 3000
lsof -i :3000

# Check port 3001
lsof -i :3001

# Check all Node processes
ps aux | grep node
```

### Restart Both Servers

```bash
# Kill all Node processes (careful!)
killall node

# Or kill specific ports
kill -9 $(lsof -ti:3000)
kill -9 $(lsof -ti:3001)

# Start fresh (see Quick Start section)
```

### View Logs with Timestamps

```bash
# SleepConnect (Terminal 1)
cd ~/code/SAX/sleepconnect
npm run dev 2>&1 | ts '[%Y-%m-%d %H:%M:%S]'

# Outreach (Terminal 2)
cd ~/code/SAX/twilio-conversations-react
npm run dev -- -p 3001 2>&1 | ts '[%Y-%m-%d %H:%M:%S]'
```

---

## 📚 Related Documentation

- **Multi-Zone Deployment Guide**: `MULTI-ZONE-DEPLOYMENT-GUIDE.md`
- **Deployment Handover**: `DEPLOYMENT-HANDOVER.md`
- **SLA Implementation**: `~/code/SAX/sleepconnect/lambdas/lambda-sms-outreach/SLA-IMPLEMENTATION-COMPLETE.md`

---

## 🎓 Development Workflow

### Typical Development Session

1. **Start SleepConnect** (Terminal 1)

   ```bash
   cd ~/code/SAX/sleepconnect && npm run dev
   ```

2. **Start Outreach** (Terminal 2)

   ```bash
   cd ~/code/SAX/twilio-conversations-react && npm run dev -- -p 3001
   ```

3. **Open Browser** (Multi-zone access)

   ```bash
   open http://localhost:3000/outreach/conversations
   ```

4. **Make Changes**
   - Edit files in either project
   - Hot reload should work automatically
   - Check terminal for errors

5. **Test Changes**
   - Refresh browser
   - Check console for errors (F12)
   - Test full user flow

6. **Commit Changes**

   ```bash
   # In the appropriate repo
   git add .
   git commit -m "feat: your change description"
   git push origin your-branch
   ```

---

## ✅ Checklist for New Developers

Before starting development:

- [ ] Node.js 18+ installed
- [ ] AWS CLI configured with credentials
- [ ] Both `.env.local` files exist and configured
- [ ] Dependencies installed in both projects (`npm install`)
- [ ] Can start SleepConnect on port 3000
- [ ] Can start Outreach on port 3001
- [ ] Can access `http://localhost:3000/outreach`
- [ ] Authentication works via Auth0
- [ ] Can send/receive SMS messages
- [ ] WebSocket real-time updates working

---

**Quick Reference**:

- **SleepConnect**: `http://localhost:3000`
- **Outreach (Multi-zone)**: `http://localhost:3000/outreach`
- **Outreach (Direct)**: `http://localhost:3001/outreach`
- **REST API**: `https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev`
- **WebSocket API**: `wss://outreach-ws-dev.mydreamconnect.com`

**Ready to Start?** See **Quick Start** section above! 🚀
