---
spec_id: DST-054-user-role-management
---

# DST-054 — In-App User Role Management

| Field | Value |
|---|---|
| **Story ID** | DST-054 |
| **Epic** | EPIC-DST — Device Source of Truth (Phase 1) |
| **Theme** | T6 — Admin & Observability |
| **Priority** | P1 |
| **Story Points** | 5 |
| **Product Owner** | Nathan Payne |
| **Dependencies** | DST-003 (auth — Admin role required), DST-001 (Firestore `users` collection) |
| **Blocks** | None |

---

## User Story

As a DST Admin, I can view all registered users and change their roles directly within the application, so that I no longer need to access the Firebase Console or run CLI commands to manage access.

---

## Background

User role management in DST is currently done entirely through direct Firestore document edits — either via the Firebase Console or `gcloud` CLI. This is operationally fragile: it requires console access, is not audited, and is inaccessible to anyone who does not have Firebase project access. It also creates an asymmetry where DST is the source of truth for all device and partner data but delegates its own access control to an external tool.

The `users` Firestore collection is the sole source of role truth. A document is auto-provisioned with `role: 'viewer'` on first login via the `authenticate` middleware. The valid roles are `viewer`, `editor`, and `admin`. Role changes take effect on the next API request (backend reads fresh from Firestore on every authenticated call); on the frontend, the user must refresh or re-authenticate to see UI changes reflect their own role.

The `AuditEntityType` enum already includes `user`, meaning the audit log infrastructure can record role changes without a schema change.

---

## Scope

This story delivers:

1. **Backend:** Two new API routes under `/api/users` — list all users, update a user's role.
2. **Frontend:** A new **User Management** section surfaced within the existing `AdminPage`, plus a dedicated `/admin/users` route for direct linking.
3. **Guardrails:** Prevention of self-demotion and last-admin demotion, enforced on both backend and frontend.
4. **Audit logging:** Every role change is recorded in the `auditLog` collection using the existing `logAuditEntry()` service.

This story does **not** deliver user invitation, user deletion, or manual user creation. Users enter the system only via Google OAuth auto-provisioning.

---

## Database Changes

### `users` collection — two new fields

The existing `users` schema is extended with two write-tracking fields to support display in the management UI and audit reconstruction:

| Field | Type | Required | Description |
|---|---|---|---|
| `updatedAt` | `Timestamp \| null` | no | Server timestamp of the last role change. Null for auto-provisioned docs that have never been edited via the API. |
| `updatedBy` | `string \| null` | no | Email of the admin who last changed this user's role. Null for auto-provisioned docs. |

These fields are written only by the role-update route. They are not written during auto-provisioning.

Add both to the `User` interface in `packages/contracts/src/index.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  photoUrl: string | null;
  lastLogin: Timestamp | null;
  updatedAt: Timestamp | null;   // ← new
  updatedBy: string | null;      // ← new
}
```

Re-export from `src/lib/types.ts` and `functions/src/types/index.ts`.

No Firestore index changes are required. Existing documents without `updatedAt`/`updatedBy` are treated as `null` on read.

---

## API Routes

Two new routes, both admin-only, mounted in a new `functions/src/routes/users.ts` router and registered in `functions/src/index.ts`.

### `GET /api/users`

Returns all user documents, sorted by `displayName` ascending.

**Auth:** `requireRole('admin')`

**Response `200`:**

```json
{
  "users": [
    {
      "id": "abc123",
      "email": "jane.doe@disney.com",
      "displayName": "Jane Doe",
      "photoUrl": "https://...",
      "role": "admin",
      "lastLogin": "2026-03-04T18:22:00.000Z",
      "updatedAt": "2026-02-10T09:15:00.000Z",
      "updatedBy": "admin@disney.com"
    }
  ]
}
```

No pagination in v1 — user counts are expected to remain small (tens, not thousands). Add pagination if that assumption changes.

### `PATCH /api/users/:id/role`

Updates a single user's role.

**Auth:** `requireRole('admin')`

**Request body:**

```json
{ "role": "editor" }
```

**Validation:**

- `role` must be one of `viewer | editor | admin`. Return `400` if invalid.
- The requesting admin cannot change their own role. Return `403` with `{ "error": "Cannot change your own role" }` if `req.user.uid === id`.
- The system must retain at least one `admin`. If the target user currently has `role: 'admin'`, the route must check whether any other `admin` document exists before proceeding. If none would remain, return `409` with `{ "error": "Cannot remove the last admin" }`.

**On success:**

1. Update the `users` document: set `role`, `updatedAt: serverTimestamp()`, `updatedBy: req.user.email`.
2. Call `logAuditEntry()` from `functions/src/services/audit.ts`:
   - `entityType: 'user'`
   - `entityId: id`
   - `field: 'role'`
   - `oldValue: <previous role>`
   - `newValue: <new role>`
   - `userId: req.user.uid`
3. Return `200` with the updated user document.

**Response `200`:**

```json
{
  "user": {
    "id": "abc123",
    "email": "jane.doe@disney.com",
    "role": "editor",
    "updatedAt": "2026-03-05T14:00:00.000Z",
    "updatedBy": "npayne@disneystreaming.com"
  }
}
```

---

## Frontend

### Route

Add a new lazy-loaded route in `src/App.tsx`:

```tsx
<AdminRoute path="/admin/users" element={<UserManagementPage />} />
```

`UserManagementPage` lives at `src/pages/UserManagementPage.tsx`.

### Navigation

Add a **Users** entry to the Admin section of the sidebar in `src/components/layout/AppShell.tsx`. Visible only to admins (consistent with other admin nav items). Use the `Users` icon from `lucide-react`.

Additionally, surface a **Manage Users** card or link tile within `AdminPage.tsx`, consistent with how other admin tools (telemetry upload, alerts, audit log) are presented there.

### `UserManagementPage`

A full-page admin view at `/admin/users`.

#### Layout

- Page heading: **User Management**
- Subheading: *"Manage access roles for all DST users. Role changes take effect on the user's next page load."*
- Search input (inline, above the table): filters by name or email in real time, client-side. Use the existing `FilterPanel`-style inline input pattern for 1–2 controls (per `UI_CONSISTENCY.md`).
- User table (see below)
- No "Add User" button — users enter the system only via OAuth auto-provisioning.

#### User table

| Column | Content | Notes |
|---|---|---|
| User | Avatar + display name + email | Avatar is the `photoUrl` from Google OAuth, falling back to initials in an indigo circle if null |
| Role | Role badge + editable control | See role controls below |
| Last Login | Relative or absolute date | Use `formatDateTime()` from `src/lib/format.ts` |
| Role Last Changed | `updatedBy` + `updatedAt` | Show "—" if `updatedAt` is null (never changed via API) |

Default sort: display name ascending. No server-side sort needed — the full user list is fetched once.

The current user's row is visually distinguished (e.g., a subtle `bg-indigo-50` background or a "You" badge next to the name) so admins can easily identify their own account. The role control in their own row is disabled (greyed out) with a tooltip: *"You cannot change your own role."*

#### Role controls

Each row's role control is an inline segmented selector — three buttons ("Viewer," "Editor," "Admin") — not a dropdown. This makes the three valid states immediately scannable without opening a menu, and removes the "confirm" step for a simple toggle.

- Active state: `bg-indigo-600 text-white rounded-lg`
- Inactive state: `bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50`
- The current user's own row: all three buttons are `disabled`, `opacity-50`, `cursor-not-allowed`

On click:

1. The clicked button enters a loading state (spinner replaces text, buttons are disabled) using the existing `LoadingSpinner` component with `inline` prop.
2. The frontend calls `PATCH /api/users/:id/role`.
3. On success: the local state updates immediately (optimistic-style, but confirmed from the response). No full page reload required. The user list data in the component updates in place.
4. On error: the button returns to its previous state and an error toast is shown. Two specific errors require distinct copy:
   - `403` ("Cannot change your own role"): *"You cannot change your own role."* — this is also prevented in the UI, so this is a defense-in-depth case.
   - `409` ("Cannot remove the last admin"): *"At least one admin must remain. Assign another admin first."*
   - All other errors: *"Failed to update role. Please try again."*

#### Last-admin guardrail in the UI

If the user table contains exactly one admin, their "Admin" button should display a lock icon (`Lock` from `lucide-react`) and be non-interactive, with a tooltip: *"At least one admin must remain."* The other two buttons (Viewer, Editor) remain disabled for that row regardless of whether the current user is viewing their own row.

This is a frontend signal only; the backend enforces the same constraint authoritatively.

### API client

Add two methods to `src/lib/api.ts`:

```typescript
getUsers(): Promise<{ users: User[] }>
updateUserRole(userId: string, role: UserRole): Promise<{ user: User }>
```

### Analytics

Track two events via `trackEvent()` from `src/lib/analytics.ts`:

| Event | When | Parameters |
|---|---|---|
| `user_role_changed` | After successful `PATCH /api/users/:id/role` | `{ target_user_id, old_role, new_role }` |
| `user_management_viewed` | On `UserManagementPage` mount | — |

---

## Role Change UX — Important Caveat

Role changes write immediately to Firestore and take effect on the next API request for the **affected user**. However, the affected user's frontend role state is derived from auth state change (in `useAuth.tsx`), so they will not see UI changes (e.g., nav items appearing or disappearing, route guards lifting) until they refresh or re-authenticate.

The page subheading should communicate this: *"Role changes take effect on the user's next page load."* No additional notification or forced re-login mechanism is delivered in v1.

---

## Audit Log

Role changes are recorded using the existing `logAuditEntry()` service with `entityType: 'user'`. These entries are queryable from the existing Audit Log page (`/admin/audit`), which already supports filtering by `entityType`.

Example audit entry:

```
entityType:  user
entityId:    abc123
field:       role
oldValue:    viewer
newValue:    editor
userId:      <Firestore UID of the admin who made the change>
timestamp:   2026-03-05T14:00:00.000Z
```

---

## Acceptance Criteria

1. Admins can view a list of all DST users with their current role, last login, and role-change provenance.
2. Admins can change any user's role to `viewer`, `editor`, or `admin` via the in-app UI without accessing the Firebase Console.
3. An admin cannot change their own role — the control is disabled in the UI and rejected with `403` on the backend.
4. The system prevents demoting the last admin — enforced on the frontend (lock icon + disabled control) and backend (`409` response).
5. Every role change is recorded in the audit log with `entityType: 'user'`, `field: 'role'`, old value, new value, and the acting admin's ID.
6. The `updatedAt` and `updatedBy` fields are written on every successful role change and displayed in the UI.
7. The UI correctly disables role controls and shows a "You" indicator on the current user's own row.
8. The page is accessible only to admins (`AdminRoute` guard in `App.tsx` and `requireRole('admin')` on the backend routes).

---

## Out of Scope (v1)

- User invitation or pre-provisioning (users enter only via OAuth)
- User deactivation or deletion (no soft-delete flag exists; Firestore document deletion would be done manually if needed)
- Bulk role changes
- Role change notifications to the affected user
- Forced re-authentication after a role change
- Configurable role definitions or custom roles
