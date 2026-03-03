# Auth Schema Proposal (Viewer + Owner)

This proposal introduces persistent auth/authorization entities for future web editing and sharing, while preserving current local-owner workflows.

## Goals

- Keep current mode working: local admin + public read-only.
- Support future "wiki-style" collaboration.
- Explicitly separate:
  - `viewer`: browser/web identity
- `owner`: dataset holder (`datasets/<owner>/...`)

## Core Concepts

- A `viewer` can have different roles per `owner`.
- `owner` remains the data boundary.
- Authorization is evaluated as `(viewer, owner, role)`.

## Proposed Tables

### 1) `auth_viewers`

Stores web identities.

Columns:
- `id` (PK, bigint)
- `email` (unique, nullable for invited-only flows)
- `display_name` (nullable)
- `password_hash` (nullable if external auth later)
- `is_active` (bool, default true)
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `last_login_at` (timestamp, nullable)

Indexes:
- unique index on `email`

### 2) `auth_owners`

Maps owner metadata to existing filesystem folder (`datasets/<owner_id>`).

Columns:
- `id` (PK, bigint)
- `owner_id` (unique string; folder key)
- `title` (nullable)
- `is_active` (bool, default true)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Indexes:
- unique index on `owner_id`

### 3) `auth_owner_memberships`

Many-to-many relation between viewers and owners with role.

Columns:
- `viewer_id` (FK -> `auth_viewers.id`)
- `owner_id` (FK -> `auth_owners.id`)
- `role` (enum/string: `viewer`, `editor`, `admin`)
- `can_invite` (bool, default false)
- `created_at` (timestamp)
- `updated_at` (timestamp)

Primary key:
- (`viewer_id`, `owner_id`)

Indexes:
- index on (`owner_id`, `role`)
- index on `viewer_id`

### 4) `auth_invitations` (optional but recommended)

Controls secure onboarding for collaborators.

Columns:
- `id` (PK, bigint)
- `owner_id` (FK -> `auth_owners.id`)
- `email` (string)
- `role` (`viewer`/`editor`/`admin`)
- `token_hash` (string)
- `invited_by_viewer_id` (FK -> `auth_viewers.id`)
- `expires_at` (timestamp)
- `accepted_at` (timestamp, nullable)
- `created_at` (timestamp)

Indexes:
- index on (`owner_id`, `email`)
- index on `token_hash`

### 5) `auth_sessions` (if using stateful sessions)

Columns:
- `id` (PK, bigint)
- `viewer_id` (FK -> `auth_viewers.id`)
- `refresh_token_hash` (string)
- `user_agent` (nullable)
- `ip_address` (nullable)
- `expires_at` (timestamp)
- `revoked_at` (timestamp, nullable)
- `created_at` (timestamp)

## Authorization Rules

Baseline policy:
- `anonymous`: read-only in public mode for one configured owner.
- `viewer` membership role:
  - `viewer`: read-only
  - `editor`: can create/update domain entities
  - `admin`: full access including settings/invitations

Endpoint enforcement:
- keep route-level dependencies for mutation (`require_role("editor")`, `require_role("admin")`)
- keep public-mode middleware write block as extra guard

## Owner Resolution Strategy

For future multi-owner web app:
- `owner_id` is explicit in route path or subdomain.
- examples:
  - path-based: `/o/{owner_id}/tree`, `/o/{owner_id}/individuals/...`
  - subdomain: `{owner_id}.tree.example.com`

Current implementation compatibility:
- keep one active owner at runtime until multi-owner routing is introduced.

## Migration Plan

### Phase 0 (now)
- Keep filesystem owners in `datasets/<owner>/`.
- Keep current viewer model in code (anonymous/admin in mode).

### Phase 1
- Add `auth_owners` and bootstrap one row from current default owner.
- Add `auth_viewers` with one local admin viewer.
- Add `auth_owner_memberships` linking local admin viewer to owner as `admin`.

### Phase 2
- Add login/session endpoints and password flow.
- Replace static `DEFAULT_OWNER_ID` admin identity with DB-backed viewer lookup.

### Phase 3
- Add invitations and editor role flows.
- Enable web editing for `editor`/`admin`.
- Add audit logging for write operations.

## Minimal Audit Table (recommended)

`audit_events`:
- `id` (PK)
- `owner_id` (FK auth_owners.id)
- `viewer_id` (FK auth_viewers.id, nullable for anonymous)
- `action` (string, e.g., `individual.update`)
- `entity_type` (string)
- `entity_id` (string/int)
- `payload_json` (json/text, optional diff)
- `created_at` (timestamp)

This is useful for rollback investigation and moderation if collaboration grows.

## Notes on Existing Folder

- New canonical path is `datasets/`.
- Keep using the term `owner` in code and docs.
