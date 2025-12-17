# Layout Components

## SleepConnectShell

Provides shared Header and Footer components for multi-zone integration with the main SleepConnect application.

### Usage (Task T018a)

```tsx
import { ShellHeader, ShellFooter } from "@/components/layout/SleepConnectShell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ShellHeader userName={session?.user?.name} currentZone="outreach" />
        <main className="min-h-screen">{children}</main>
        <ShellFooter />
      </body>
    </html>
  );
}
```

### Current Implementation Status

**STUB ONLY** - This is a placeholder implementation for T018a. The current components provide:

- Basic header with logo, navigation, and user menu
- Footer with company info and links
- Proper use of `<a href>` for cross-zone navigation (not Next.js `<Link>`)

### Production Implementation Options

Before production deployment, this stub should be replaced with one of these approaches:

1. **Shared NPM Package** (Recommended)
   - Create `@sleepconnect/shell-components` package
   - Publish to private NPM registry
   - Import: `import { ShellHeader, ShellFooter } from "@sleepconnect/shell-components"`

2. **Git Submodule / Monorepo**
   - Use Turborepo or Nx to share components across zones
   - Import: `import { ShellHeader, ShellFooter } from "@repo/shell"`

3. **Module Federation**
   - Use Webpack 5 Module Federation to load components at runtime
   - Allows independent deployment of shell updates

4. **Server-Side Fetch**
   - Fetch pre-rendered shell HTML from SleepConnect endpoint
   - Most flexible but requires SSR coordination

### Design Requirements

Per NFR-005, the shell integration must:

- ✅ Use `<a href>` for cross-zone navigation (hard navigation)
- ✅ Use Next.js `<Link>` only within Outreach zone
- ✅ Maintain consistent branding across all zones
- ✅ Preserve Auth0 session context via cookies (no re-auth needed)

### Known Dependencies

- **Auth Context**: User info passed via Auth0 session from SleepConnect middleware
- **Styling**: Must match SleepConnect's Tailwind theme (imported via `globals.css`)
- **Navigation**: Links to `/dashboard`, `/patients`, `/outreach` cross zone boundaries

### Next Steps

1. Coordinate with SleepConnect team to decide on sharing approach
2. Implement chosen integration method
3. Update this README with actual import paths
4. Test cross-zone navigation and session persistence
5. Verify styling consistency across zones
