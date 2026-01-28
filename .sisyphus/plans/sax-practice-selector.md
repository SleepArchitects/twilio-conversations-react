# SAX Practice Selector for New Conversations

## Repository & Working Directory

**Repository**: `twilio-conversations-react` (Outreach Frontend)

```
Base path: /home/dan/code/SAX/twilio-conversations-react/
```

All file paths in this plan are relative to this repo root.

---

## Context

### Original Request

SAX users (Sleep Architects staff) need the ability to select which practice a new conversation belongs to, rather than being locked to their own practice from Auth0 claims.

### Interview Summary

**Key Discussions**:

- Currently `practice_id` comes from `userContext.practiceId` (Auth0 JWT claims)
- SAX users have cross-tenant/cross-practice access (see `useIsSAXUser.ts`)
- `usePracticeName.ts` already fetches practice list via `/api/practices`
- This is a **frontend-only change** - the API route already forwards whatever `practice_id` is sent

**Research Findings**:

- `NewConversationModal.tsx` (1221 lines) handles conversation creation
- `useIsSAXUser()` hook exists and returns `{ data: boolean, isLoading: boolean }`
- `/api/practices` endpoint returns `PracticeListItem[]` with `practice_id` and `name`
- API route `app/api/outreach/conversations/route.ts` uses `userContext.practiceId` in the Lambda payload (line 546)

---

## Work Objectives

### Core Objective

Enable SAX users to select any practice when creating a new conversation, while non-SAX users continue with their default practice.

### Concrete Deliverables

- New hook: `hooks/usePractices.ts` - Fetch all practices (reuse `usePracticeName` pattern)
- Modified component: `components/conversations/NewConversationModal.tsx` - Add practice dropdown for SAX users
- Modified API types: `types/sms.ts` - Add `practiceId` to `CreateConversationRequest`
- Modified API route: `app/api/outreach/conversations/route.ts` - Accept optional `practiceId` override

### Definition of Done

- [ ] SAX users see a practice dropdown when opening NewConversationModal
- [ ] Non-SAX users see no dropdown (their default practice is used)
- [ ] Selected practice is included in the create conversation API call
- [ ] Backend receives the selected `practice_id` in the Lambda payload
- [ ] Dropdown shows practice names, sorted alphabetically
- [ ] No TypeScript errors (`pnpm lint-types` passes)
- [ ] ESLint passes (`pnpm lint` passes)

### Must Have

- Practice dropdown only visible to SAX users
- Selected practice sent to backend
- Graceful loading state while practices load
- Default to user's own practice if SAX

### Must NOT Have (Guardrails)

- No changes to backend Lambda (sleepconnect repo)
- No changes to authentication/authorization logic
- No new npm dependencies
- No breaking changes to non-SAX user flow
- No tenant selector (out of scope - stays within user's tenant)

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (Playwright E2E in repo)
- **User wants tests**: Manual verification
- **Framework**: Playwright (browser automation for visual verification)

### Manual QA Only

**By Deliverable Type**: Frontend/UI

**Verification Tool**: Playwright browser automation

---

## Task Flow

```
Task 1 (usePractices hook) → Task 2 (Modal UI) → Task 3 (API integration) → Task 4 (QA)
```

## Parallelization

| Task | Depends On | Reason                    |
| ---- | ---------- | ------------------------- |
| 1    | None       | New hook, no dependencies |
| 2    | 1          | Modal needs hook          |
| 3    | 2          | API needs modal changes   |
| 4    | 3          | QA needs all code changes |

---

## TODOs

- [ ] 1. Create `usePractices` hook for fetching practice list

  **What to do**:
  1. Create new file `hooks/usePractices.ts`
  2. Export hook that fetches from `/api/practices` (SleepConnect endpoint)
  3. Return `{ data: Practice[], isLoading, error }` shape
  4. Use TanStack Query with `staleTime: 5 * 60 * 1000` (5 min cache)
  5. Sort practices alphabetically by name

  **Code Pattern** (from `usePracticeName.ts`):

  ```typescript
  import { useQuery } from "@tanstack/react-query";

  interface Practice {
    practice_id: string;
    name: string;
  }

  export function usePractices() {
    return useQuery({
      queryKey: ["practices", "list"],
      staleTime: 5 * 60 * 1000,
      queryFn: async (): Promise<Practice[]> => {
        const baseUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "";
        const response = await fetch(`${baseUrl}/api/practices`, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch practices: ${response.status}`);
        }
        const list = await response.json();
        return list.sort((a: Practice, b: Practice) =>
          a.name.localeCompare(b.name),
        );
      },
    });
  }
  ```

  **Must NOT do**:
  - Don't add new dependencies
  - Don't change `usePracticeName.ts` (keep backward compatible)

  **Parallelizable**: NO (must complete before Task 2)

  **References**:
  - `hooks/usePracticeName.ts:19-83` - Pattern for fetching practices (fetch, credentials, error handling)
  - `hooks/useCurrentUserRoles.ts` - TanStack Query hook pattern with caching

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] File created: `hooks/usePractices.ts`
  - [ ] `pnpm lint-types` passes with no errors related to new hook
  - [ ] Hook can be imported: `import { usePractices } from "@/hooks/usePractices"`

  **Commit**: YES
  - Message: `feat(hooks): add usePractices hook for fetching practice list`
  - Files: `hooks/usePractices.ts`, `hooks/index.ts` (if barrel export exists)

---

- [ ] 2. Add practice selector dropdown to NewConversationModal for SAX users

  **What to do**:
  1. Import `useIsSAXUser` and `usePractices` hooks
  2. Add state for selected practice: `const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null)`
  3. Add `BuildingIcon` component (similar to existing icons)
  4. Add practice dropdown UI between patient search and divider (around line 956)
  5. Only render dropdown when `isSAXUser && !isSAXLoading`
  6. Pre-select user's default practice (from props or userContext)
  7. Show loading spinner while practices load
  8. Include selected practice in form submission

  **UI Pattern** (match existing dropdown style):

  ```tsx
  {
    /* Practice Selector - SAX Users Only */
  }
  {
    isSAXUser && !isSAXLoading && (
      <div>
        <label
          htmlFor="practice-select"
          className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-1.5"
        >
          <BuildingIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
          Practice
          <span className="text-red-400" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="practice-select"
          value={selectedPracticeId || ""}
          onChange={(e) => setSelectedPracticeId(e.target.value)}
          disabled={isSubmitting || practicesLoading}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg text-sm",
            "bg-gray-900 text-white",
            "border border-gray-600",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {practicesLoading ? (
            <option value="">Loading practices...</option>
          ) : (
            practices?.map((p) => (
              <option key={p.practice_id} value={p.practice_id}>
                {p.name}
              </option>
            ))
          )}
        </select>
      </div>
    );
  }
  ```

  **Must NOT do**:
  - Don't show dropdown to non-SAX users
  - Don't change existing form flow for non-SAX users
  - Don't add tenant selector (out of scope)

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  - `components/conversations/NewConversationModal.tsx:170-276` - Existing icon components pattern
  - `components/conversations/NewConversationModal.tsx:838-956` - Patient search input styling
  - `hooks/useIsSAXUser.ts` - SAX user detection hook

  **Acceptance Criteria**:

  **Manual Execution Verification (Playwright):**
  - [ ] Using playwright browser automation:
    - Navigate to outreach app as SAX user
    - Click "New Conversation" button
    - Verify: Practice dropdown is visible
    - Verify: Dropdown contains list of practices
    - Verify: Can select a different practice
  - [ ] Using playwright browser automation:
    - Navigate to outreach app as non-SAX user
    - Click "New Conversation" button
    - Verify: Practice dropdown is NOT visible

  **Commit**: YES
  - Message: `feat(modal): add practice selector for SAX users in NewConversationModal`
  - Files: `components/conversations/NewConversationModal.tsx`

---

- [ ] 3. Pass selected practice to API and update types

  **What to do**:
  1. Update `types/sms.ts`:
     - Add `practiceId?: string` to `CreateConversationRequest` interface

  2. Update `NewConversationModal.tsx`:
     - Include `practiceId: selectedPracticeId` in the API request body
     - Only include if SAX user and practice selected

  3. Update `app/api/outreach/conversations/route.ts`:
     - Accept optional `body.practiceId` in POST handler
     - If provided, use it instead of `userContext.practiceId` in `createPayload`
     - Only allow override for SAX users (check `userContext.isSAXUser`)

  **API Route Change** (around line 544-551):

  ```typescript
  // Determine practice_id: use override if SAX user provided one, otherwise default
  const practiceId =
    userContext.isSAXUser && body.practiceId
      ? body.practiceId
      : userContext.practiceId;

  const createPayload = {
    tenant_id: userContext.tenantId,
    practice_id: practiceId, // Use determined practice
    coordinator_sax_id: userContext.saxId,
    // ... rest unchanged
  };
  ```

  **Must NOT do**:
  - Don't allow non-SAX users to override practice
  - Don't change Lambda backend (sleepconnect repo)
  - Don't add tenant override (out of scope)

  **Parallelizable**: NO (depends on Task 2)

  **References**:
  - `types/sms.ts` - Type definitions for SMS API
  - `app/api/outreach/conversations/route.ts:466-551` - POST handler and createPayload
  - `components/conversations/NewConversationModal.tsx:726-736` - Current request building

  **Acceptance Criteria**:

  **Manual Execution Verification (curl/Playwright):**
  - [ ] `pnpm lint-types` passes
  - [ ] `pnpm lint` passes
  - [ ] Using playwright browser automation as SAX user:
    - Create conversation with non-default practice selected
    - Verify: Conversation is created successfully
    - Verify: Backend receives correct `practice_id` (check network tab)

  **Commit**: YES
  - Message: `feat(api): allow SAX users to specify practice when creating conversations`
  - Files: `types/sms.ts`, `app/api/outreach/conversations/route.ts`, `components/conversations/NewConversationModal.tsx`

---

- [ ] 4. Integration QA - Test all scenarios

  **What to do**:

  Test ALL scenarios in dev environment using Playwright browser automation:

  | #   | Scenario                               | Expected                     | Verify                              |
  | --- | -------------------------------------- | ---------------------------- | ----------------------------------- |
  | 1   | SAX user opens modal                   | Practice dropdown visible    | Dropdown appears                    |
  | 2   | SAX user selects different practice    | Dropdown updates             | Selected value changes              |
  | 3   | SAX user creates conversation          | Uses selected practice       | Check `practice_id` in network call |
  | 4   | SAX user creates with default practice | Uses their own practice      | Check `practice_id` matches default |
  | 5   | Non-SAX user opens modal               | No practice dropdown         | Dropdown not rendered               |
  | 6   | Non-SAX user creates conversation      | Uses their practice from JWT | Check `practice_id` in network call |
  | 7   | SAX user with slow network             | Loading state shown          | "Loading practices..." appears      |
  | 8   | Practices fetch fails                  | Graceful error handling      | No crash, error shown               |

  **Must NOT do**:
  - Skip any scenario
  - Accept TypeScript/ESLint errors
  - Accept console errors in browser

  **Parallelizable**: NO (final verification step)

  **Acceptance Criteria**:
  - [ ] All 8 scenarios pass
  - [ ] `pnpm lint-types` passes
  - [ ] `pnpm lint` passes
  - [ ] No console errors in browser
  - [ ] Modal still works correctly for non-SAX users (regression check)

  **Commit**: NO (QA only)

---

## Commit Strategy

| After Task | Message                                                                      | Files                                                                                                          |
| ---------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1          | `feat(hooks): add usePractices hook for fetching practice list`              | `hooks/usePractices.ts`                                                                                        |
| 2          | `feat(modal): add practice selector for SAX users in NewConversationModal`   | `components/conversations/NewConversationModal.tsx`                                                            |
| 3          | `feat(api): allow SAX users to specify practice when creating conversations` | `types/sms.ts`, `app/api/outreach/conversations/route.ts`, `components/conversations/NewConversationModal.tsx` |

---

## Success Criteria

### Verification Commands

```bash
pnpm lint-types  # Expected: No TypeScript errors
pnpm lint        # Expected: No ESLint errors
pnpm build       # Expected: Build succeeds
```

### Final Checklist

- [ ] SAX users can select practice in NewConversationModal
- [ ] Non-SAX users see no practice dropdown (unchanged experience)
- [ ] Selected practice is sent to backend API
- [ ] Backend uses selected practice for SAX users
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds
- [ ] All 8 QA scenarios pass
