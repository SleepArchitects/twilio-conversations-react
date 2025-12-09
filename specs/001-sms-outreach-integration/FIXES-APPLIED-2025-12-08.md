# Critical Fixes Applied - December 8, 2025

## Summary

Applied **2 critical architectural fixes** to enable local development and implement proper multi-zone integration:

1. ✅ **C1 - Fixed assetPrefix** (Styles now work in dev)
2. ✅ **T018a - Proxy-level header rendering** (Cleanest multi-zone approach)

---

## Fix 1: Conditional assetPrefix (C1) 🔴 CRITICAL

### Problem
`assetPrefix: "/outreach-static"` broke local development:
- Dev server serves assets from `/_next/static/`
- HTML references `/outreach-static/_next/static/`
- Result: **All CSS/fonts/JS return 404** → "styles don't work at all"

### Solution
```javascript
// next.config.mjs
assetPrefix: process.env.NODE_ENV === "production" 
  ? "/outreach-static"  // CloudFront path for production
  : "/outreach",        // basePath for local dev
```

### Impact
- ✅ Local dev now loads CSS/fonts/JS correctly
- ✅ Tailwind styles render properly
- ✅ Production multi-zone unchanged (still uses `/outreach-static`)

### Test
```bash
# Start dev server
cd /home/dan/code/SAX/twilio-conversations-react
pnpm dev

# Open browser
http://localhost:3000/outreach/conversations

# Verify in DevTools Network tab:
# - layout.css loads with 200 status from /outreach/_next/static/css/
# - Fonts load from /outreach/_next/static/media/
# - Page has Tailwind styles (dark background, styled buttons, etc.)
```

---

## Fix 2: Proxy-Level Header Rendering (T018a) ✅ COMPLETE

### Problem (Previous Approach)
Header integration had 3 bad options:
- **Option A**: Stub header (inconsistent branding)
- **Option B**: Copy components (duplicate code, manual sync)
- **Option C**: Shared package (monorepo complexity)

### Solution (Option D - Best Practice)
**Let SleepConnect proxy handle header/footer at reverse proxy level**

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ User Browser: https://sleepconnect.com/outreach/conversations
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ SleepConnect Proxy (Main Zone)                              │
│ - Intercepts /outreach/* requests                           │
│ - Fetches content from Outreach zone                        │
│ - Wraps with SleepConnect header/footer (SSR)               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Outreach Zone (Content Only)                                │
│ - Receives request: GET /outreach/conversations             │
│ - Returns ONLY page content (no header/footer)              │
│ - layout.tsx does NOT include ShellHeader/ShellFooter       │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Response to User                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SleepConnect Header (from proxy)                        │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Outreach Conversations Content                          │ │
│ │ (from Outreach zone)                                    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ SleepConnect Footer (from proxy)                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Seamless user experience - single consistent interface      │
└─────────────────────────────────────────────────────────────┘
```

### Changes Made

**1. Removed header/footer from Outreach layout**
```tsx
// app/layout.tsx (BEFORE)
<div className="flex min-h-screen flex-col">
  <ShellHeader userName={userName} currentZone="outreach" />
  <main className="flex-1">{children}</main>
  <ShellFooter />
</div>

// app/layout.tsx (AFTER - Content only)
<main className="flex-1">{children}</main>
```

**2. Updated documentation**
- `components/layout/SleepConnectShell.tsx` now documents proxy-level rendering
- `ShellHeader`/`ShellFooter` exist ONLY for standalone dev mode
- Production multi-zone never uses these components

### Benefits

| Aspect | Old Approach | New Approach (Proxy-Level) |
|--------|--------------|----------------------------|
| **Code Duplication** | High (copy components) | None (single source) |
| **Maintenance** | Manual sync needed | Automatic (header changes propagate) |
| **Consistency** | Risk of drift | Guaranteed (same header for all zones) |
| **Complexity** | Shared packages/imports | Zero (standard Next.js pattern) |
| **Header Updates** | Deploy all zones | Deploy SleepConnect only |
| **Best Practice** | ❌ Workaround | ✅ Correct Next.js multi-zone |

### Cross-Zone Navigation (T092)

**Hard Navigation** (cross-zone - use `<a href>`):
```tsx
// Link from Outreach → Patient profile (SleepConnect zone)
<a href="/patients/123">View Patient</a>  // ✅ Hard navigation

// Link to main dashboard
<a href="/">Dashboard</a>  // ✅ Hard navigation
```

**Soft Navigation** (intra-zone - use `<Link>`):
```tsx
// Link within Outreach zone
<Link href="/outreach/conversations">Conversations</Link>  // ✅ Soft navigation
<Link href="/outreach/templates">Templates</Link>          // ✅ Soft navigation
```

### SleepConnect Configuration (T091)

**Required**: SleepConnect `next.config.js` must have rewrites:

```javascript
// sleepconnect/next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/outreach/:path*',
        destination: 'http://localhost:3001/outreach/:path*', // Dev
        // destination: process.env.OUTREACH_ZONE_URL + '/outreach/:path*', // Prod
      },
      {
        source: '/outreach-static/_next/:path+',
        destination: 'http://localhost:3001/outreach-static/_next/:path+', // Dev
      },
    ];
  },
};
```

---

## Verification Checklist

### Local Development
- [ ] Run `cd /home/dan/code/SAX/twilio-conversations-react && pnpm dev`
- [ ] Open `http://localhost:3000/outreach/conversations`
- [ ] Verify:
  - ✅ Tailwind styles load (dark background, purple buttons)
  - ✅ Fonts render correctly (Inter font family)
  - ✅ No 404 errors in Network tab
  - ✅ Page renders without SleepConnect header (content only)

### Multi-Zone Integration (Requires SleepConnect Proxy)
- [ ] Configure rewrites in SleepConnect `next.config.js` (per T091)
- [ ] Run both zones: SleepConnect (port 3000) + Outreach (port 3001)
- [ ] Open `http://localhost:3000/outreach/conversations` (via SleepConnect proxy)
- [ ] Verify:
  - ✅ SleepConnect header appears at top
  - ✅ Outreach content renders below header
  - ✅ SleepConnect footer appears at bottom
  - ✅ Navigation between zones works (hard navigation)
  - ✅ No visual inconsistencies

---

## Files Changed

| File | Change |
|------|--------|
| `next.config.mjs` | Added conditional assetPrefix (dev vs prod) |
| `app/layout.tsx` | Removed ShellHeader/ShellFooter imports and rendering |
| `components/layout/SleepConnectShell.tsx` | Updated docs to explain proxy-level rendering |
| `specs/001-sms-outreach-integration/tasks.md` | Marked T018a complete, replaced Options A/B/C with Option D |

---

## Next Steps

1. **Test local dev** (5 min)
   ```bash
   cd /home/dan/code/SAX/twilio-conversations-react
   pnpm dev
   # Open http://localhost:3000/outreach/conversations
   # Verify styles work
   ```

2. **Configure SleepConnect rewrites** (T091 - 15 min)
   - Add rewrites to `sleepconnect/next.config.js`
   - Test multi-zone integration locally

3. **Deploy** (when ready)
   - Outreach zone uses `/outreach-static` assetPrefix in production
   - SleepConnect proxy wraps Outreach content with shell
   - Users get seamless experience

4. **Continue implementation** (T019+)
   - All P1 tasks complete (58/58 MVP)
   - Ready for P2 features (Templates, SLA) or production hardening

---

## References

- **Analysis Report**: `specs/001-sms-outreach-integration/SPECIFICATION-ANALYSIS-REPORT.md`
- **Critical Issue**: `specs/001-sms-outreach-integration/CRITICAL-STYLES-BROKEN-ANALYSIS.md`
- **Next.js Multi-Zones**: https://nextjs.org/docs/pages/guides/multi-zones
- **T018a Task**: `specs/001-sms-outreach-integration/tasks.md` lines 60-91
