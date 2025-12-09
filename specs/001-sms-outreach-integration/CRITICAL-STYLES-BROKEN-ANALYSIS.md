# Critical Issue: Styles Not Working - Analysis & Fix

**Date**: 2025-12-08  
**Severity**: 🔴 **CRITICAL** - Application completely broken  
**Status**: Root cause identified

---

## Problem

Styles are completely broken - Tailwind CSS classes not applying, page appears unstyled.

## Root Cause

**Multi-zone assetPrefix configuration breaks local development**

```javascript
// next.config.mjs
basePath: "/outreach",
assetPrefix: "/outreach-static",  // ❌ PROBLEM
```

### What This Does

1. Next.js generates CSS at: `.next/static/css/app/layout.css`
2. HTML references CSS as: `/outreach-static/_next/static/css/app/layout.css`
3. **Local dev server** serves assets from: `http://localhost:3000/_next/static/...`
4. **Browser tries to fetch**: `http://localhost:3000/outreach-static/_next/static/...`
5. **Result**: 404 - CSS not found, no styles applied

### Why This Exists

Per NFR-005 and FR-033, the `assetPrefix` is required for production multi-zone deployment:
- SleepConnect CloudFront serves main app from `/`
- Outreach zone assets served from `/outreach-static/`
- Prevents asset path conflicts between zones

**This works in production** (via CloudFront/proxy) but **breaks local development**.

---

## Solution Options

### Option 1: Conditional assetPrefix (RECOMMENDED) ✅

**Make assetPrefix conditional based on environment**

```javascript
// next.config.mjs
const nextConfig = {
  basePath: "/outreach",
  assetPrefix: process.env.NODE_ENV === "production" 
    ? "/outreach-static" 
    : "/outreach",  // Use basePath for dev
  // ... rest of config
};
```

**Pros:**
- Works in both dev and production
- No manual switching needed
- Matches Next.js best practices

**Cons:**
- None

**Testing:**
```bash
# Dev (assetPrefix = /outreach)
pnpm dev
# → CSS loads from http://localhost:3000/outreach/_next/static/css/...

# Production build (assetPrefix = /outreach-static)
NODE_ENV=production pnpm build
# → CSS references /outreach-static/_next/static/css/...
```

---

### Option 2: Remove assetPrefix for Dev (Manual Switch)

**Temporarily comment out assetPrefix for local development**

```javascript
// next.config.mjs (for dev)
const nextConfig = {
  basePath: "/outreach",
  // assetPrefix: "/outreach-static",  // ❌ Commented for dev
};

// next.config.mjs (for production)
const nextConfig = {
  basePath: "/outreach",
  assetPrefix: "/outreach-static",  // ✅ Uncommented for prod
};
```

**Pros:**
- Simple, immediate fix

**Cons:**
- Manual switching required
- Easy to forget before deployment
- Risk of deploying wrong config

---

### Option 3: Environment Variable Override

**Use .env to control assetPrefix**

```javascript
// next.config.mjs
const nextConfig = {
  basePath: "/outreach",
  assetPrefix: process.env.NEXT_PUBLIC_ASSET_PREFIX || "/outreach",
};
```

```bash
# .env.local (dev)
NEXT_PUBLIC_ASSET_PREFIX=/outreach

# .env.production (production)
NEXT_PUBLIC_ASSET_PREFIX=/outreach-static
```

**Pros:**
- Explicit configuration per environment
- Easy to override for testing

**Cons:**
- Extra environment variable to manage
- Less automatic than Option 1

---

## Recommended Fix

**Implement Option 1: Conditional assetPrefix**

This is the standard Next.js pattern for multi-zone apps that need different asset paths in dev vs production.

### Implementation

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Output standalone for OpenNext deployment
  output: "standalone",

  // Multi-zone configuration for sleepconnect integration
  basePath: "/outreach",
  
  // Use /outreach-static in production (CloudFront), /outreach in dev (local server)
  assetPrefix: process.env.NODE_ENV === "production" 
    ? "/outreach-static" 
    : "/outreach",

  // ... rest of config unchanged
};
```

### Verification Steps

1. **Apply fix** to `next.config.mjs`
2. **Restart dev server**: `pnpm dev`
3. **Open browser**: `http://localhost:3000/outreach/conversations`
4. **Verify styles load**:
   - Open DevTools → Network tab
   - Look for `layout.css` - should be `200 OK` from `/outreach/_next/static/css/`
   - Page should have Tailwind styles applied (dark background, styled buttons, etc.)

5. **Test production build**:
   ```bash
   NODE_ENV=production pnpm build
   # Check build output - assets should reference /outreach-static/
   ```

---

## Impact on Spec Analysis

This issue affects:

| ID | Finding | Impact |
|----|---------|--------|
| **NEW-1** | **CRITICAL** | assetPrefix breaks local dev | Add to tasks.md as T003a: "Configure conditional assetPrefix for dev/prod" |
| **C1** | Homepage redirect | Cannot verify - styles broken |
| **G1** | NFR-001 Core Web Vitals | Cannot measure - styles broken |
| **G2** | NFR-002 Accessibility | Cannot audit - styles broken |

**All verification blocked until styles are fixed.**

---

## Updated Task

Add to Phase 1 (Setup):

```markdown
- [ ] T003a [P] Configure conditional assetPrefix in next.config.mjs - use basePath in dev, /outreach-static in production to prevent local dev CSS 404s
```

Or update existing T003:

```markdown
- [~] T003 [P] Configure next.config.js with basePath '/outreach', assetPrefix '/outreach-static', and security headers
  **ISSUE**: assetPrefix breaks local dev (CSS 404s). Need conditional: process.env.NODE_ENV === 'production' ? '/outreach-static' : '/outreach'
```

---

## Next Steps

1. **IMMEDIATE**: Apply Option 1 fix to `next.config.mjs`
2. **Restart dev server**: `pnpm dev`
3. **Verify styles work**: Open `http://localhost:3000/outreach/conversations`
4. **Update tasks.md**: Mark T003 as partial with fix note
5. **Resume spec analysis**: Once styles confirmed working
6. **Document in plan.md**: Add note about dev/prod assetPrefix pattern

---

## Root Cause Category

**Configuration Error** - Multi-zone asset path configuration not accounting for local development environment.

**Prevention**: Always test multi-zone apps in local dev mode before production deployment. Document environment-specific config patterns.
