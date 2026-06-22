# Admin Account Lifecycle And Test Reset Plan

## Status snapshot

As of 2026-06-21, this file should be read as the current implementation record plus the remaining work.

### Implemented

- existing `user | admin` role model remains in place
- existing scoped admin permissions remain in place
- new `admin_users` permission scope has been added in shared schemas
- admin role/permission editing is restricted at API level to `admin_users:write`
- admin role/permission editing UI is restricted to admins with `admin_users` visibility
- "super admin" is currently derived by identity, not stored as a separate role
- local super-admin identity is currently `shamanproto`
- non-super-admin permission edits cannot grant durable `admin_users` rights
- admin user detail view now uses an explicit `Save access` CTA instead of autosave
- read-only admin viewers cannot modify permission controls
- block/unblock account action exists
- `is_test_account` support now exists at the data-model and API level
- reset user flow action exists for privileged admins and deletes the local account so the same email can register again
- reset user flow is now restricted to accounts explicitly marked as test accounts
- native admin audit logging now exists for account-access and lifecycle actions
- last-super-admin protection now blocks demotion/blocking that would leave zero effective super admins
- scheduled deletion workflow now exists:
  - accounts can be moved to `pending_deletion`
  - scheduled purge anonymizes the account and removes direct identity/auth data

### Still to do

- add self-protection rules:
  - consider whether self-editing of admin rights should be completely disallowed, even when it would not orphan admin management
- add admin UI surfaces for test-account toggling and deletion scheduling/cancellation
- document and enforce environment-specific retention windows
- refine anonymization and retention rules with legal/compliance review for production

### Current product position

- `block account` is an operational access-control action and is available now
- `reset user flow` is a destructive local-account reset intended for tightly controlled admin use
- `delete for privacy/compliance` is not yet implemented as a formal workflow and should not be treated as equivalent to the current reset action

## Current baseline

The codebase already has:

- `users.role` with `user | admin`
- `user_admin_permissions` with scoped `read | write` access
- admin auth and permission checks in `apps/api/src/admin/routes.ts`
- an admin bootstrap path and a `create-admin` script that currently grant full access

That means the cleanest next step is not a brand-new top-level role first. It is:

- keep `role = admin`
- add one new admin permission scope for admin management
- treat "super admin" as an admin with that extra scope and full write permissions

This avoids widening the auth model unless we later need a hard database-level distinction.

## Delivery status by area

### 1. Admin privileges and limitations

Done:

- dedicated `admin_users` permission scope introduced
- only admins with `admin_users:write` can edit admin rights through the current access-update route
- admin UI now respects the same boundary

Pending:

- admin creation flow should also be formally tied to `admin_users:write`
- `create-admin` bootstrap script should be reviewed so it is treated as bootstrap-only, not routine admin management
- prevent privilege accidents:
  - self-demotion
  - self-removal of `admin_users:write`
  - demotion/blocking of the last remaining super admin
- add an admin-management view or explicit create-admin action in the panel if needed

### 2. Test user workflow

Done:

- design direction decided: separate `reset onboarding` from `reset to fresh signup`
- current implementation includes a privileged `reset user flow` action that deletes the local account and releases the email for re-registration
- current reset action is hidden for admin targets and self-targeting, and requires privileged admin-management rights

Pending:

- add admin actions:
  - mark/unmark test account
  - reset onboarding
  - scheduled deletion / cancel deletion UI
- define exactly which related records are preserved, cleared, archived, or deleted
- add confirmation copy in admin UI for the new lifecycle actions

### 3. Account manipulation and EU-style retention/deletion

Done:

- policy direction decided:
  - block for operational control
  - separate deletion workflow for privacy/compliance
  - avoid routine hard-delete by admins in production
- current implementation distinguishes operational block/unblock from destructive reset
- current reset flow is suitable for controlled test/admin intervention, not as a GDPR-style deletion workflow

Pending:

- define retention windows by environment and user type
- define anonymization rules for records that must remain for security, fraud, or legal reasons
- document the production operational procedure for handling deletion requests

## Product goals

We want four separate admin actions with different intent:

1. `Block account`
2. `Reset onboarding`
3. `Reset to fresh signup` for test accounts
4. `Request deletion` with delayed purge

We also want:

- only privileged admins to create or modify other admins
- ordinary admins to never self-escalate
- test-only reset actions to be isolated from normal production users

## Recommended account lifecycle model

Do not overload `is_blocked` to represent deletion or reset. Add explicit lifecycle fields.

### Users table additions

Add to `users`:

- `account_state text not null default 'active'`
- `is_test_account boolean not null default false`
- `deleted_at timestamptz null`
- `deletion_requested_at timestamptz null`
- `deletion_scheduled_for timestamptz null`
- `deletion_reason text null`
- `test_reset_at timestamptz null`

Recommended `account_state` values:

- `active`
- `blocked`
- `pending_deletion`
- `archived`
- `deleted`

Notes:

- `blocked` means access removed immediately, but account still exists.
- `pending_deletion` means user cannot log in and data purge is scheduled.
- `archived` is optional but useful for retired test accounts or internal recovery.
- `deleted` should only be used if the row remains after anonymization. If the row is physically removed, this state is not needed.

### Optional onboarding table

If onboarding/setup state is currently spread across several tables, add a dedicated table:

- `user_onboarding_state`

Suggested fields:

- `user_id`
- `signup_completed_at`
- `email_verified_at`
- `provider_connect_started_at`
- `provider_connected_at`
- `profile_completed_at`
- `initial_tutorial_completed_at`
- `last_reset_by_admin_id`
- `last_reset_at`

This keeps reset logic explicit instead of relying on ad hoc nulling in many places.

## Test account policy

Only accounts marked with `is_test_account = true` can use the full "fresh signup reset" flow from the admin panel.

### Rules

- Real users: can be blocked or scheduled for deletion, but not fresh-reset by admins.
- Test users: can be reset to onboarding or reset to fresh signup.
- Test users should be easy to identify in admin UI.
- Consider restricting test accounts to:
  - explicit admin toggle
  - allowlisted emails
  - allowlisted domains
  - non-production environments only for the most destructive variants

### Implementation status

Pending:

- schema field
- admin toggle
- UI badge/filter
- enforcement in fresh-signup reset endpoint

## Admin role model

## Recommendation

Use two effective admin tiers without introducing a second role yet:

- `Admin`
- `Super admin`

Implementation:

- both still use `users.role = 'admin'`
- permissions determine capability

### Add new permission scope

Extend `adminPermissionScopeSchema` with:

- `admin_users`

Meaning:

- `admin_users:read` can view admin assignments
- `admin_users:write` can create admins, change admin permissions, mark test accounts, and run destructive admin-only user lifecycle actions

This is the guardrail you currently do not have. Right now any admin with `users:write` can become too powerful if UI/API allow it.

### Capability split

Standard admin can have:

- `dashboard`
- `users`
- `events`
- `integrations`
- `emails`
- `analytics`

Super admin should additionally have:

- `admin_users`

### Hard rules

- Only `admin_users:write` can promote a user to admin.
- Only `admin_users:write` can edit another admin's permissions.
- Only `admin_users:write` can mark or unmark `is_test_account`.
- Only `admin_users:write` can run `reset to fresh signup`.
- No admin can remove their own `admin_users:write`.
- No admin can block or demote the last remaining super admin.

If later you want stronger separation, add `role = 'super_admin'`. For now it is not necessary.

### Implementation status

Done:

- permission boundary for editing admin rights now uses `admin_users:write`

Pending:

- promote this scope into bootstrap/admin seeding rules
- add self-protection and last-super-admin protections

## Admin action protocols

### 1. Block account

Purpose:

- fraud
- abuse
- support hold
- temporary access revocation

Effects:

- set `is_blocked = true`
- set `account_state = 'blocked'`
- set `blocked_at = now()`
- revoke all refresh tokens
- reject new logins
- keep data and history intact

Unblock:

- set `is_blocked = false`
- set `account_state = 'active'` if not pending deletion

Implementation status:

- partially implemented now:
  - `is_blocked`
  - `blocked_at`
  - refresh-token revocation on block
- still pending:
  - unified `account_state`
  - audit logging

### 2. Reset onboarding

Purpose:

- let a user repeat onboarding or setup without losing account history

Allowed for:

- support use cases
- test accounts
- optionally real users if product support needs it

Effects:

- revoke all refresh tokens
- clear onboarding state table or related progress columns
- optionally clear provider connection state if that is part of onboarding
- keep:
  - user row
  - email
  - password hash
  - user id
  - most historical data

User outcome:

- user logs back in with the same email/password
- user sees onboarding again

Implementation status:

- not implemented

### 3. Reset to fresh signup

Purpose:

- retest "create account with email and password" from zero

Allowed for:

- `is_test_account = true` only

Effects:

- revoke all refresh tokens
- remove password auth identity or detach its email
- clear password hash
- clear onboarding state
- clear provider integrations
- clear profile data as needed
- archive or remove user-owned test artifacts
- release the original email so signup can reuse it

Recommended implementation pattern:

- keep the old row as archived
- rename old email to `retired+<userId>@example.invalid`
- remove password auth identity for the old account
- set `account_state = 'archived'`
- create no replacement user automatically
- let the person sign up again from the public signup flow

This is cleaner than trying to preserve the same user id through a true fresh signup.

Implementation status:

- not implemented

### 4. Request deletion

Purpose:

- privacy/compliance
- support-requested account deletion

Effects:

- set `account_state = 'pending_deletion'`
- set `deletion_requested_at = now()`
- set `deletion_scheduled_for = now() + retention_window`
- revoke all refresh tokens
- disable login

Purge job later:

- anonymize or delete PII
- remove auth identities
- remove refresh tokens and reset tokens
- delete avatar assets
- delete or anonymize profile/preferences rows
- keep only minimal operational/legal records if required

Recommended retention window:

- test accounts: immediate or 24 hours
- real users: 7 to 30 days depending on policy

Implementation status:

- not implemented

## Data retention decision table

### Block

- Keep user history: yes
- Keep login access: no
- Reversible: yes

### Reset onboarding

- Keep user history: yes
- Keep same email/password: yes
- Reversible: not usually needed

### Reset to fresh signup

- Keep user history visible to user: no
- Keep internal archived record: optional yes
- Same email reusable: yes

### Deletion

- Keep user history visible to user: no
- Keep minimal audit/security records: yes, if necessary
- Same email reusable: yes after purge/anonymization

## EU/privacy handling notes

This section is the operational interpretation for product and engineering. It is not legal advice.

### Principles to implement

- Data minimisation:
  - do not keep personal data longer than necessary
- Storage limitation:
  - every retained user data category should have a reason and a retention rule
- Separation of intents:
  - block is not delete
  - reset is not delete
  - archive is not delete
- Controlled erasure:
  - when deletion is requested, disable access first, then purge/anonymize according to policy

### What should usually be deleted or anonymized

- email address
- password hash
- auth identities
- password reset tokens
- refresh tokens
- avatar files
- personal profile fields
- preferences tied to identity

### What may need limited retention

- security logs
- admin audit logs
- fraud/abuse investigation records
- records needed for legal claims or regulatory obligations

Rule:

- if retained, keep the minimum necessary data
- where possible, replace direct identifiers with internal ids or anonymized values

### Email reuse rule

For both fresh-signup reset and deletion, the original email should become reusable. The safest pattern is:

- detach or delete the old password identity
- rename archived account emails to a reserved invalid format such as `retired+<id>@example.invalid`

### Production admin protocol

- ordinary admins can block/unblock if they have user-management rights
- only `admin_users:write` admins can manipulate admin rights or run destructive reset actions
- deletion should be a scheduled workflow, not an instant casual button
- destructive actions should be confirmed and audited

## Formal admin SOP

This section is the operational protocol the team should follow with the current implementation.

### 1. Role and permission governance

- Treat "super admin" as an admin identity that effectively has `admin_users:write`.
- Do not give routine admins the ability to create, promote, demote, or re-scope other admins.
- Restrict admin-rights editing to the smallest possible set of named operators.
- At the time of writing, `shamanproto` is the only intended super-admin identity.

### 2. Allowed actions by admin tier

- Standard admins:
  - can use ordinary admin read/write scopes they already hold
  - can block or reactivate user accounts if they have the corresponding user-management access
  - cannot edit admin permissions
  - cannot grant admin rights
  - cannot run destructive reset actions
- Super admins / `admin_users:write` admins:
  - can edit admin rights
  - can promote or demote admins within the implemented route boundary
  - can run the current `reset user flow` action on non-admin targets
  - must use destructive actions only for controlled support or testing cases

### 3. Current account-action meanings

- `Block account`
  - operational action
  - immediately prevents normal access/session refresh
  - does not erase history
  - should be used for abuse handling, support containment, or temporary access suspension
- `Reset user flow`
  - destructive local-account reset
  - releases the email so the person can sign up again from scratch
  - removes local account history tied to that account
  - should only be used for tightly controlled testing/support scenarios
- `Delete for privacy/compliance`
  - not yet implemented as a formal production workflow
  - must not be simulated by casually using the reset action unless the business explicitly accepts that limitation

### 4. Mandatory operating rules

- Never use `reset user flow` on admins.
- Never use `reset user flow` as a substitute for a formal legal/privacy erasure workflow.
- Never broaden admin rights without a named business owner approving the change.
- Prefer `block` over destructive reset whenever the goal is simply to suspend access.
- Record who performed a destructive action and why until system audit logging exists.

### 5. Audit procedure

Native admin audit logging now exists for lifecycle/admin-rights mutations. For support and compliance operations, teams should still mirror high-risk actions in their operational tooling with:

- actor admin identity
- target user id and email
- action type
- reason
- timestamp
- whether the action was support-driven, testing-driven, or privacy-driven

Store this in the team's operational log, support tracker, or incident record when the action is legally sensitive, user-facing, or part of an incident.

### 6. EU/privacy handling protocol

- Treat account blocking, test reset, and privacy deletion as separate legal/operational intents.
- If a user exercises deletion/privacy rights, use a dedicated request record and do not rely on the current reset button as the whole process.
- The future deletion workflow should:
  - disable access immediately
  - revoke sessions/tokens
  - schedule purge or anonymization
  - preserve only the minimum legally necessary records
  - make the original email reusable once the identity link is removed or replaced
- Until that workflow exists, any privacy-driven account removal should be treated as a controlled manual operation requiring explicit review.

## API changes

### Shared schema

Update `packages/shared/src/index.ts`:

- extend `adminPermissionScopeSchema` with `admin_users`
- add new admin request/response schemas for lifecycle actions

Implementation status:

- `admin_users` scope done
- lifecycle schemas pending

Suggested endpoints:

- `POST /v1/admin/users/:userId/block`
- `POST /v1/admin/users/:userId/unblock`
- `POST /v1/admin/users/:userId/reset-onboarding`
- `POST /v1/admin/users/:userId/reset-fresh-signup`
- `POST /v1/admin/users/:userId/request-deletion`
- `POST /v1/admin/users/:userId/cancel-deletion`
- `POST /v1/admin/users/:userId/test-account`
- `POST /v1/admin/admin-users`

Or keep the existing style and add:

- `PUT /v1/admin/users/:userId/lifecycle`
- `PUT /v1/admin/users/:userId/test-settings`

I would prefer explicit action endpoints because they are easier to audit and harder to misuse.

### API permission enforcement

Add checks in `apps/api/src/admin/routes.ts`:

- `users:write` for block/unblock
- `admin_users:write` for:
  - promote/demote admin
  - edit admin permissions
  - mark test account
  - fresh-signup reset
  - deletion override actions

Implementation status:

- promote/demote admin and edit permissions now gated by `admin_users:write`
- remaining lifecycle enforcement pending

### Store layer additions

Add methods in `apps/api/src/auth/store.ts` for:

- `setUserAccountStateById`
- `setUserTestAccountFlagById`
- `renameUserEmailById`
- `clearUserPasswordById`
- `deletePasswordIdentityByUserId`
- `deleteIntegrationsByUserId`
- `clearUserProfileByUserId`
- `clearUserPreferencesByUserId`
- `archiveUserForFreshSignupReset`
- `scheduleUserDeletionById`

Also add a single transaction wrapper for destructive flows:

- `resetUserToFreshSignupById({ targetUserId, actorUserId })`

That transaction should be atomic.

## Admin UI changes

In `apps/admin/src/pages/AdminUserDetailsPage.tsx` add a new section:

- `Account lifecycle`

Actions:

- Block / Unblock
- Reset onboarding
- Reset to fresh signup
- Request deletion
- Cancel deletion
- Mark as test account

UI rules:

- show destructive actions only to `admin_users:write`
- show `reset to fresh signup` only when `is_test_account = true`
- require a confirmation modal with explicit consequence text
- show immutable audit metadata:
  - who performed the last reset
  - when
  - current lifecycle state

For admin creation and permission editing:

- move current access editing behind `admin_users:write`
- standard admins may view roles but not modify them

Implementation status:

- access editing restriction done
- lifecycle controls and admin-creation UX pending

## Audit protocol

Add an admin audit table before shipping destructive account tools.

Suggested table:

- `admin_audit_logs`

Fields:

- `id`
- `actor_user_id`
- `target_user_id`
- `action`
- `metadata jsonb`
- `created_at`

Actions to log:

- admin_created
- admin_permissions_changed
- account_blocked
- account_unblocked
- test_account_marked
- onboarding_reset
- fresh_signup_reset
- deletion_requested
- deletion_cancelled
- deletion_purged

This matters more than adding a separate `super_admin` role.

Implementation status:

- not implemented

## Background jobs

Add a scheduled worker for deletion processing:

- scan `users` where `account_state = 'pending_deletion'`
- purge those past `deletion_scheduled_for`
- write admin audit log

Fresh-signup reset does not need a background job if implemented as a single admin action.

Implementation status:

- not implemented

## Rollout sequence

### Phase 1

- add `admin_users` permission scope
- restrict admin promotion and permission editing to `admin_users:write`
- prevent self-demotion and last-super-admin lockout

### Phase 2

- add user lifecycle fields
- add audit table
- keep current block/unblock path but write lifecycle state too

### Phase 3

- add `is_test_account`
- implement `reset onboarding`
- implement `reset to fresh signup`

### Phase 4

- implement `request deletion`
- add worker purge flow
- add policy copy in admin UI

## Recommendation summary

For this codebase, the best near-term design is:

- keep `user | admin` roles
- add `admin_users` permission scope
- define "super admin" as an admin with `admin_users:write`
- add explicit account lifecycle state fields
- reserve full fresh-signup reset for `is_test_account = true`
- require audit logging before enabling destructive flows in production

This gives you the separation you want without overcomplicating the auth model.

## Implementation checklist

Use this section as the execution tracker. Status values:

- `done`
- `next`
- `later`

### Phase 1. Lock down admin governance

#### Ticket A1. Keep `admin_users` as the admin-management gate

Status:

- `done`

Scope:

- shared schema contains `admin_users`
- admin access-edit route requires `admin_users:write`
- admin UI hides rights editing without `admin_users:write`

Acceptance criteria:

- an admin with `users:write` but without `admin_users:write` cannot edit another admin's rights
- an admin with `admin_users:write` can still edit admin rights

#### Ticket A2. Update bootstrap and seed behavior

Status:

- `next`

Scope:

- review `apps/api/scripts/create-admin.ts`
- review `/admin/bootstrap/promote`
- define which bootstrap-created admins receive full write access including `admin_users`

Acceptance criteria:

- bootstrap paths create intended super admins with `admin_users:write`
- bootstrap paths are documented as setup-only, not routine admin management

Dependencies:

- none

#### Ticket A3. Add self-protection rules

Status:

- `next`

Scope:

- prevent an admin from removing their own `admin_users:write`
- prevent an admin from demoting themselves from admin if they are the only super admin
- prevent blocking or demoting the last remaining super admin

Acceptance criteria:

- API returns a clear conflict error for forbidden self-downgrade attempts
- API returns a clear conflict error if an action would leave zero super admins
- UI surfaces the error cleanly

Dependencies:

- A2

#### Ticket A4. Decide whether admin creation lives in UI

Status:

- `later`

Scope:

- either keep admin creation as bootstrap-only
- or add explicit create-admin action in admin UI guarded by `admin_users:write`

Acceptance criteria:

- there is one documented path for production admin creation
- routine admin creation is not possible outside approved flow

Dependencies:

- A2

### Phase 2. Add explicit account lifecycle model

#### Ticket B1. Add lifecycle fields to `users`

Status:

- `next`

Scope:

- `account_state`
- `is_test_account`
- `deleted_at`
- `deletion_requested_at`
- `deletion_scheduled_for`
- `deletion_reason`
- `test_reset_at`

Acceptance criteria:

- migration applies cleanly
- existing users backfill to `account_state = 'active'`
- type-safe access exists in API/store layer

Dependencies:

- none

#### Ticket B2. Introduce onboarding/reset state persistence

Status:

- `next`

Scope:

- create `user_onboarding_state` or confirm an equivalent pattern in existing tables
- capture reset metadata

Acceptance criteria:

- onboarding progress can be cleared without touching unrelated user data
- reset metadata can be displayed in admin UI later

Dependencies:

- B1

#### Ticket B3. Align block/unblock with lifecycle model

Status:

- `next`

Scope:

- when blocked, set `account_state = 'blocked'`
- when unblocked, restore `active` if no other lifecycle status applies

Acceptance criteria:

- existing block functionality still works
- lifecycle state is consistent with `is_blocked`

Dependencies:

- B1

### Phase 3. Implement test account workflow

#### Ticket C1. Add test-account marking

Status:

- `next`

Scope:

- admin endpoint to mark/unmark `is_test_account`
- admin UI badge and toggle
- restrict to `admin_users:write`

Acceptance criteria:

- super admins can mark and unmark test accounts
- standard admins cannot
- test accounts are visually obvious in admin UI

Dependencies:

- A1
- B1

#### Ticket C2. Implement `reset onboarding`

Status:

- `next`

Scope:

- revoke refresh tokens
- clear onboarding state
- optionally clear provider connection state if considered onboarding-only
- keep email, password, user id, and primary history

Acceptance criteria:

- user logs in again with the same credentials
- user sees onboarding again
- non-onboarding history remains intact

Dependencies:

- B2

#### Ticket C3. Implement `reset to fresh signup`

Status:

- `next`

Scope:

- allow only for `is_test_account = true`
- revoke sessions
- detach or delete password identity
- clear password hash
- archive account
- release original email for reuse

Acceptance criteria:

- test account can no longer log in after reset
- same email can sign up again from the public signup flow
- old test account is archived, not silently mixed with the new account

Dependencies:

- B1
- B2
- C1

#### Ticket C4. Define data treatment matrix for reset flows

Status:

- `next`

Scope:

- specify for each relevant table whether data is kept, cleared, archived, anonymized, or deleted during:
  - reset onboarding
  - reset to fresh signup

Target tables at minimum:

- `users`
- `user_auth_identities`
- `refresh_tokens`
- `password_reset_tokens`
- `user_profiles`
- `user_preferences`
- `integrations`
- user-owned event/sync records if applicable

Acceptance criteria:

- no destructive reset endpoint ships without an explicit table-by-table rule

Dependencies:

- B1

### Phase 4. Add auditability

#### Ticket D1. Add `admin_audit_logs`

Status:

- `next`

Scope:

- create audit table
- write rows for admin-rights changes, block/unblock, test flag changes, resets, deletion requests, purges

Acceptance criteria:

- every destructive or privilege-changing admin action writes an audit record
- audit records capture actor, target, action, metadata, timestamp

Dependencies:

- A1

#### Ticket D2. Surface audit metadata in admin UI

Status:

- `later`

Scope:

- show last reset timestamp
- show last reset actor
- show deletion state and scheduled purge date

Acceptance criteria:

- support/admin users can inspect lifecycle history without querying the database directly

Dependencies:

- D1

### Phase 5. Implement privacy-compliant deletion flow

#### Ticket E1. Add deletion request workflow

Status:

- `next`

Scope:

- endpoint to request deletion
- endpoint to cancel deletion before purge
- set `pending_deletion` state
- disable login and revoke sessions immediately

Acceptance criteria:

- deleted-requested users cannot log in
- account is marked pending deletion with a scheduled purge date
- cancellation works before purge

Dependencies:

- B1
- D1

#### Ticket E2. Define retention and anonymization rules

Status:

- `next`

Scope:

- classify each retained data type
- define retention window by category
- define anonymization strategy for data that must remain

Acceptance criteria:

- there is a written mapping from data category to:
  - purpose
  - retention duration
  - deletion or anonymization behavior

Dependencies:

- none

#### Ticket E3. Build purge worker

Status:

- `later`

Scope:

- scheduled worker scans pending deletions
- purges or anonymizes data after `deletion_scheduled_for`
- writes audit log

Acceptance criteria:

- expired pending deletions are processed automatically
- purge is idempotent
- failures are observable and retryable

Dependencies:

- E1
- E2
- D1

### Phase 6. UX and policy hardening

#### Ticket F1. Add lifecycle controls to admin user details

Status:

- `later`

Scope:

- add `Account lifecycle` section
- actions:
  - block/unblock
  - mark test account
  - reset onboarding
  - reset to fresh signup
  - request deletion
  - cancel deletion

Acceptance criteria:

- destructive actions require confirmation
- actions are visible only when the current admin has the required permission

Dependencies:

- C1
- C2
- C3
- E1

#### Ticket F2. Add policy copy and support procedure

Status:

- `later`

Scope:

- brief explanatory copy in admin UI
- internal support procedure for:
  - when to block
  - when to reset onboarding
  - when to use fresh-signup reset
  - when to request deletion

Acceptance criteria:

- admins can distinguish operational actions from privacy actions without ambiguity

Dependencies:

- E2

## Recommended implementation order

1. Finish admin safety: A2, A3.
2. Add lifecycle schema groundwork: B1, B2, B3.
3. Add audit logging: D1.
4. Add test-account marking and onboarding reset: C1, C2.
5. Define data treatment rules and implement fresh-signup reset: C4, C3.
6. Add deletion request flow and retention policy: E1, E2.
7. Build purge worker and full admin lifecycle UI: E3, F1, F2.

## Immediate next sprint recommendation

If you want the smallest high-value next slice, do this sprint:

- A2. update bootstrap/admin seeding for `admin_users`
- A3. add self-protection and last-super-admin safeguards
- B1. add `account_state` and `is_test_account`
- C1. add test-account marking

That gets the admin governance model into a safe state before any destructive reset or deletion features are added.
