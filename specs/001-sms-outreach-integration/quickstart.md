# Quickstart: SMS Outreach Integration

**Feature**: 001-sms-outreach-integration  
**Date**: 2025-11-28  
**Status**: Draft

This guide provides developer onboarding instructions for the SMS Outreach Integration feature.

---

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18.x or 20.x LTS | Runtime |
| pnpm | 10.x | Package manager (matching sleepconnect) |
| PostgreSQL client | 16+ | Local database testing |
| AWS CLI | 2.x | Lambda/RDS access |
| Git | 2.x | Version control |

### Access Requirements

| Resource | Access Level | Contact |
|----------|--------------|---------|
| AWS Account (dev) | Developer role | DevOps team |
| Auth0 Tenant | Application access | Security team |
| Twilio Account | API keys | Platform team |
| GitHub Repository | Write access | Team lead |
| PostgreSQL RDS (SAXDBDEV) | Read/Write | Database admin |

---

## Environment Setup

### 1. Clone Repository

```bash
# Clone twilio-conversations-react
git clone git@github.com:your-org/twilio-conversations-react.git
cd twilio-conversations-react

# Checkout feature branch
git checkout 001-sms-outreach-integration
```

### 2. Install Dependencies

```bash
# Install pnpm if not already installed
npm install -g pnpm@10

# Install project dependencies
pnpm install
```

### 3. Environment Variables

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Configure the following environment variables:

```dotenv
# ===================================================================
# NEXT.JS CONFIGURATION
# ===================================================================
NEXT_PUBLIC_APP_BASE_URL="http://localhost:3001"

# ===================================================================
# TWILIO CONFIGURATION
# ===================================================================
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_API_KEY_SID="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_API_KEY_SECRET="your-api-key-secret"
TWILIO_CONVERSATIONS_SERVICE_SID="ISxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+14694052606"

# ===================================================================
# AUTH0 CONFIGURATION
# ===================================================================
AUTH0_SECRET="generate-32-char-random-string"
AUTH0_ISSUER_BASE_URL="https://sleeparchitects.us.auth0.com/"
AUTH0_BASE_URL="http://localhost:3001"
AUTH0_CLIENT_ID="your-client-id"
AUTH0_CLIENT_SECRET="your-client-secret"
AUTH0_AUDIENCE="multiple-apis"

# ===================================================================
# DATABASE CONFIGURATION (PostgreSQL via Lambda)
# ===================================================================
DATABASE_URL="postgresql://user:password@host:5432/SAXDBDEV"
# Note: In production, database access is via Lambda functions
# Direct connection is for local testing only

# ===================================================================
# AWS CONFIGURATION
# ===================================================================
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# ===================================================================
# FEATURE FLAGS
# ===================================================================
NEXT_PUBLIC_ENABLE_SENTIMENT_ANALYSIS="true"
NEXT_PUBLIC_ENABLE_SLA_MONITORING="true"
```

### 4. Multi-Zone Configuration

This application runs as a Next.js multi-zone with `basePath: '/sms'`:

```javascript
// next.config.js
module.exports = {
  basePath: '/sms',
  assetPrefix: '/sms/',
  
  // Required for multi-zone integration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};
```

---

## Local Development

### Start Development Server

```bash
# Start the SMS zone on port 3001
pnpm dev

# The application will be available at:
# http://localhost:3001/sms
```

### Running with SleepConnect (Full Stack)

For full multi-zone testing, run both applications:

```bash
# Terminal 1: Start sleepconnect on port 3000
cd ../sleepconnect
pnpm dev

# Terminal 2: Start SMS zone on port 3001
cd ../twilio-conversations-react
pnpm dev

# Access points:
# - Main app: http://localhost:3000
# - SMS zone: http://localhost:3001/sms
```

### Database Access

For local development with PostgreSQL:

```bash
# Connect to development database
psql "postgresql://user:password@saxdbdev.cluster-xxx.us-east-1.rds.amazonaws.com:5432/SAXDBDEV"

# Run schema migrations (when available)
pnpm db:migrate
```

---

## Project Structure

```text
twilio-conversations-react/
├── app/                      # Next.js App Router
│   ├── layout.tsx            # Root layout with Flowbite theme
│   ├── page.tsx              # Redirect to /conversations
│   ├── globals.css           # Tailwind + sleepconnect styles
│   ├── conversations/        # Conversation views
│   │   ├── page.tsx          # List view
│   │   └── [id]/
│   │       └── page.tsx      # Detail view
│   ├── templates/
│   │   └── page.tsx          # Template management
│   ├── analytics/
│   │   └── page.tsx          # Analytics dashboard
│   └── api/
│       └── outreach/         # API routes
│           ├── conversations/
│           ├── messages/
│           ├── templates/
│           ├── analytics/
│           ├── token/
│           └── webhook/
├── components/               # React components
│   ├── ui/                   # Shared UI (from sleepconnect)
│   ├── conversations/        # Conversation components
│   ├── messages/             # Message components
│   └── templates/            # Template components
├── hooks/                    # Custom React hooks
├── lib/                      # Utilities and helpers
│   ├── twilio.ts             # Twilio client setup
│   ├── auth.ts               # Auth0 utilities
│   └── db.ts                 # Database utilities
├── types/                    # TypeScript definitions
└── specs/                    # Feature specifications
    └── 001-sms-outreach-integration/
        ├── plan.md
        ├── research.md
        ├── data-model.md
        ├── quickstart.md      # This file
        └── contracts/
            └── sms-api.yaml
```

---

## API Development

### API Route Pattern

All API routes follow the `/api/outreach/` prefix and use Next.js App Router conventions:

```typescript
// app/api/outreach/conversations/route.ts
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async (request) => {
  const session = await getSession();
  const { user } = session;
  
  // Fetch conversations for authenticated user
  const conversations = await fetchConversations(user.sax_id);
  
  return NextResponse.json(conversations);
});
```

### OpenAPI Specification

The API contract is defined in `specs/001-sms-outreach-integration/contracts/sms-api.yaml`.

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/outreach/conversations` | List conversations |
| POST | `/api/outreach/conversations` | Create conversation |
| GET | `/api/outreach/conversations/{id}` | Get conversation |
| PATCH | `/api/outreach/conversations/{id}` | Update conversation |
| DELETE | `/api/outreach/conversations/{id}` | Archive conversation |
| GET | `/api/outreach/conversations/{id}/messages` | List messages |
| POST | `/api/outreach/conversations/{id}/messages` | Send message |
| GET/POST/PATCH/DELETE | `/api/outreach/templates` | Template CRUD |
| GET | `/api/outreach/analytics` | Analytics data |
| POST | `/api/outreach/token` | Get Twilio access token |
| POST | `/api/outreach/webhook` | Twilio webhook handler |

---

## Testing

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Run API integration tests
pnpm test:integration
```

### End-to-End Tests

```bash
# Run Playwright E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

### Test Database

For integration tests, use a separate test database:

```bash
# Set test database URL
export DATABASE_URL="postgresql://user:password@localhost:5432/saxdbdev_test"

# Run migrations on test database
pnpm db:migrate:test
```

---

## Deployment

### SST Deployment (Matching SleepConnect)

This project uses SST (OpenNext) for AWS deployment:

```bash
# Deploy to development
pnpm sst deploy --stage dev

# Deploy to staging
pnpm sst deploy --stage staging

# Deploy to production
pnpm sst deploy --stage prod
```

### Environment-Specific Configuration

| Stage | Base URL | Auth0 Callback |
|-------|----------|----------------|
| dev | `https://dev.mydreamconnect.com/sms` | `https://dev.mydreamconnect.com/sms/api/auth/callback` |
| staging | `https://staging.mydreamconnect.com/sms` | `https://staging.mydreamconnect.com/sms/api/auth/callback` |
| prod | `https://mydreamconnect.com/sms` | `https://mydreamconnect.com/sms/api/auth/callback` |

### CloudFront Multi-Zone Routing

The main CloudFront distribution routes `/sms/*` to this zone:

```text
CloudFront Behaviors:
  /sms/*     → SMS Zone Origin (this app)
  /*         → SleepConnect Origin
```

---

## Twilio Integration

### Twilio Console Setup

1. **Create Conversations Service**:
   - Go to Twilio Console → Conversations → Services
   - Create new service for SMS Outreach
   - Note the Service SID (`ISxxx`)

2. **Configure Webhooks**:
   - Set Pre-Event URL: `https://your-domain.com/sms/api/outreach/webhook`
   - Set Post-Event URL: `https://your-domain.com/sms/api/outreach/webhook`
   - Enable events: `onMessageAdded`, `onConversationUpdated`

3. **API Keys**:
   - Generate API Key under Account → API Keys
   - Use for frontend access token generation

### Testing Twilio Locally

Use ngrok to expose local webhook endpoint:

```bash
# Start ngrok tunnel
ngrok http 3001

# Update Twilio webhook URLs to ngrok URL:
# https://abc123.ngrok.io/sms/api/outreach/webhook
```

---

## Troubleshooting

### Common Issues

#### Auth0 Callback URL Mismatch

**Error**: `Callback URL mismatch`

**Solution**: Ensure Auth0 application has the correct callback URL:
- Development: `http://localhost:3001/sms/api/auth/callback`
- Production: `https://mydreamconnect.com/sms/api/auth/callback`

#### Twilio Token Generation Fails

**Error**: `Unable to generate access token`

**Solution**: Verify API Key credentials in `.env.local`:
- `TWILIO_API_KEY_SID` should start with `SK`
- `TWILIO_API_KEY_SECRET` is the key's secret (not auth token)

#### Database Connection Issues

**Error**: `ECONNREFUSED` or `Connection refused`

**Solution**: 
- Ensure AWS credentials are configured
- For local dev, use direct database URL
- For production, verify Lambda execution role has RDS access

#### Multi-Zone Routing Issues

**Error**: 404 on `/sms` routes

**Solution**:
- Verify `basePath: '/sms'` in `next.config.js`
- Check CloudFront behavior configuration
- Ensure origin points to correct zone

---

## Resources

### Documentation

- [Next.js Multi-Zones](https://nextjs.org/docs/app/building-your-application/deploying/multi-zones)
- [Twilio Conversations SDK](https://www.twilio.com/docs/conversations/javascript)
- [Auth0 Next.js SDK](https://github.com/auth0/nextjs-auth0)
- [Flowbite React Components](https://flowbite-react.com/)
- [SST Deployment](https://docs.sst.dev/)

### Internal References

- [Feature Spec](./spec.md)
- [Data Model](./data-model.md)
- [Research](./research.md)
- [API Contract](./contracts/sms-api.yaml)
- [SleepConnect Patterns](../../../sleepconnect/docs/)

### Team Contacts

| Role | Contact |
|------|---------|
| Platform Lead | #platform-team |
| Security Review | #security-team |
| Database Admin | #database-team |
| DevOps | #devops-team |

---

## Next Steps

After completing this setup:

1. ✅ Review the [Data Model](./data-model.md) for entity definitions
2. ✅ Review the [API Contract](./contracts/sms-api.yaml) for endpoint specifications
3. ⏳ Wait for Phase 2 tasks to be generated
4. ⏳ Implement according to task assignments
