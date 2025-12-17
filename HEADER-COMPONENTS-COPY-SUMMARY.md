# SleepConnect Header Components Copy Summary
## Date: December 8, 2025

## ✅ FILES SUCCESSFULLY COPIED

### Layout Components
1. ✅ `/components/layout/Banner.tsx`
2. ✅ `/components/layout/Footer.tsx`
3. ✅ `/components/layout/Header/MainHeader.tsx`
4. ✅ `/components/layout/Header/ClientHeader.tsx`
5. ✅ `/components/layout/Header/NavMenu.tsx`

### UI Dropdown Components
6. ✅ `/components/ui/AdminDropdown.tsx`
7. ✅ `/components/ui/ManageDropdown.tsx`
8. ✅ `/components/ui/UserDropdown.tsx`
9. ✅ `/components/ui/NotificationsDropdown.tsx`
10. ✅ `/components/ui/MobileMenu.tsx`

### UI Utility Components
11. ✅ `/components/ui/PageLoader.tsx`
12. ✅ `/components/ui/CookieConsent.tsx`

### Auth Components
13. ✅ `/components/auth/showIfAuthenticated.tsx`

### Icon Components
14. ✅ `/components/icons/AdminMenuIcon.tsx`
15. ✅ `/components/icons/ClipboardIcon.tsx`
16. ✅ `/components/icons/MenuIcon.tsx`
17. ✅ `/components/icons/NotificationsIcon.tsx`
18. ✅ `/components/icons/ChevronDownIcon.tsx`
19. ✅ `/components/icons/ChevronUpIcon.tsx`
20. ✅ `/components/icons/index.ts`

### Hooks
21. ✅ `/hooks/useCurrentUserRoles.ts`
22. ✅ `/hooks/useAuth.ts`

### Lib Utilities
23. ✅ `/lib/buildInfo.ts`
24. ✅ `/lib/flowbite-theme.ts`

### Types
25. ✅ `/types/notifications.ts`

### Utils
26. ✅ `/utils/notificationHelpers.ts`

---

## ⚠️ MISSING DEPENDENCIES (Need to be created/adapted)

These files are referenced by the copied components but don't exist in the destination project. They need to be created or adapted:

### Critical Missing Dependencies

1. **`/lib/auth/claims-transformer.ts`**
   - Referenced by: `hooks/useAuth.ts`
   - Contains: `createPlainUserObject` function
   - Purpose: Transforms Auth0 user claims into plain object

2. **`/utils/userAssignedRoles/fetchUserRoles.ts`**
   - Referenced by: `hooks/useCurrentUserRoles.ts`
   - Contains: `fetchUserRoles` function, `UserRole` type
   - Purpose: Fetches user's assigned roles from API

3. **`/utils/roles/fetchRoles.ts`**
   - Referenced by: `hooks/useCurrentUserRoles.ts`
   - Contains: `fetchRoles` function
   - Purpose: Fetches all available roles from API

4. **`/components/roles/types.ts`**
   - Referenced by: `hooks/useCurrentUserRoles.ts`
   - Contains: `Role` type
   - Purpose: Type definition for Role object

5. **`/components/modals/CookieSettings.tsx`**
   - Referenced by: `components/ui/CookieConsent.tsx`
   - Contains: CookieSettings modal component
   - Purpose: Settings modal for cookie preferences

---

## 📦 EXTERNAL DEPENDENCIES REQUIRED

The following npm packages are required and should be added to `package.json`:

### Already Installed (likely)
- `@auth0/nextjs-auth0` - Auth0 authentication
- `next` - Next.js framework
- `react` - React library
- `react-dom` - React DOM

### Need to Verify/Install
- `flowbite-react` - Flowbite React components (Dropdown, Avatar, etc.)
- `date-fns` - Date formatting utilities (`formatDistanceToNowStrict`)
- `lucide-react` - Icon library (Moon, MoonStar, Star, Sun, X, Ticket, User, Building)
- `@tanstack/react-query` - React Query for data fetching (used in hooks)

---

## 🔧 ADAPTATIONS NEEDED

### Import Path Changes
All copied files use `@/` import alias. Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### API Endpoints Needed
The following API endpoints are referenced and need to exist:

1. **`/api/profile`** - Get user profile data
2. **`/api/profile/image?key=...`** - Get presigned URL for profile image
3. **`/api/notifications?limit=...`** - Get notifications
4. **`/api/notifications?unread_only=true&count_only=true`** - Get unread count
5. **`/api/notifications?count_only=true`** - Get total count
6. **`/auth/login`** - Auth0 login endpoint
7. **`/auth/logout`** - Auth0 logout endpoint

### Environment Variables Needed
```bash
# Banner configuration
NEXT_PUBLIC_SHOW_BANNER=true
NEXT_PUBLIC_BANNER_LOGO=moonplus
NEXT_PUBLIC_BANNER_LINK=/
NEXT_PUBLIC_BANNER_TEXT=Meet Alora

# Auth0 configuration
# (Auth0 vars should already exist)
```

### Build Info Setup
The Footer component expects `/public/build-info.json` to exist with structure:
```json
{
  "version": "0.1.0",
  "buildNumber": 0,
  "commitHash": "dev",
  "commitDate": "2025-12-08",
  "branch": "development",
  "buildDate": "2025-12-08T...",
  "fullVersion": "0.1.0.0",
  "displayVersion": "v0.1.0 (Development)"
}
```

---

## ⚡ NEXT STEPS

1. **Install missing dependencies:**
   ```bash
   pnpm add flowbite-react date-fns lucide-react @tanstack/react-query
   ```

2. **Create stub files for missing dependencies:**
   - Create placeholder functions for fetchUserRoles, fetchRoles
   - Create simple Role and UserRole types
   - Create claims-transformer utility
   - Create CookieSettings modal (or remove Cookie Consent if not needed)

3. **Set up API routes:**
   - Create placeholder API routes for profile and notifications
   - Or adapt imports to use existing Twilio/Outreach API structure

4. **Test the header:**
   - Import and use `MainHeader` component in a page
   - Verify auth flow works correctly
   - Test responsive behavior (desktop/mobile)

5. **Handle role-based access:**
   - Implement actual role fetching logic
   - Or stub out role checks to return true for testing

---

## 📝 FILES COPIED VERBATIM (NO MODIFICATIONS)

All 26 files were copied without modifications. They retain all SleepConnect-specific:
- Role names (e.g., "Manage Charts", "Patients", "Alora")
- Route paths (e.g., `/dashboard`, `/organizations`, `/task-center`)
- API endpoints
- Branding references

These will need to be adapted based on the Outreach project's specific requirements.

---

## 🎯 INTEGRATION CHECKLIST

- [ ] Install required npm packages
- [ ] Create missing dependency files (or stub them)
- [ ] Set up Auth0 configuration
- [ ] Create necessary API endpoints
- [ ] Configure environment variables
- [ ] Create build-info.json or remove Footer build info display
- [ ] Test header component in a page
- [ ] Verify role-based rendering works
- [ ] Test mobile menu functionality
- [ ] Verify notification dropdown (if using)
- [ ] Test user dropdown and logout flow
- [ ] Adapt routes and role names for Outreach project
