# 🌳 Genealogy Database Frontend - High-Level Design Document

**Version:** 1.2
**Date:** December 28, 2025
**Status:** Approved - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Development Environment Setup](#3-development-environment-setup)
4. [Architecture Overview](#4-architecture-overview)
5. [User Authentication Scheme](#5-user-authentication-scheme)
6. [Application Pages & Navigation](#6-application-pages--navigation)
7. [Data Management Modes](#7-data-management-modes)
8. [Component Design](#8-component-design)
9. [State Management](#9-state-management)
10. [API Integration](#10-api-integration)
11. [Media Management](#11-media-management)
12. [Export Functionality](#12-export-functionality)
13. [Browser Support](#13-browser-support)
14. [Error Logging & Monitoring](#14-error-logging--monitoring)
15. [Testing Strategy](#15-testing-strategy)
16. [Implementation Phases](#16-implementation-phases)
17. [Design Decisions Summary](#17-design-decisions-summary)
18. [Postponed Features](#18-postponed-features)

---

## 1. Executive Summary

This document outlines the high-level design for a modern web frontend for the Genealogy Database application. The frontend will provide:

- **CRUD operations** for Individuals, Families, Events, and Media
- **Two editing modes**: Table mode for bulk data entry, Individual/Family mode for detailed editing
- **Media management**: Upload, view, and bind photos/videos/audio to records
- **Export functionality**: Download GEDCOM + media as a ZIP archive
- **Secure authentication**: Manual user registration with password-based login

### Key Design Principles

1. **Simplicity First** - Clean, intuitive interface suitable for non-technical viewers
2. **Responsive Design** - Works on desktop, tablet, and mobile
3. **Progressive Enhancement** - Core functionality works without JavaScript; enhanced with JS
4. **Accessibility** - WCAG 2.1 AA compliant

---

## 2. Technology Stack

### 2.1 Core Technologies

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **React 18+** | UI Framework | Most popular, large ecosystem, excellent tooling |
| **TypeScript** | Type Safety | Catches errors early, better IDE support, self-documenting code |
| **Vite** | Build Tool | Fast dev server, optimized builds, modern ESM-based |
| **React Router v6** | Navigation | Standard for React SPAs, supports nested routes |

### 2.2 UI & Styling

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **Tailwind CSS** | Utility Styling | Fast development, consistent design, small bundle |
| **Headless UI** | Accessible Components | Works with Tailwind, fully accessible |
| **Lucide React** | Icons | Clean, consistent icon set, tree-shakeable |
| **React Hot Toast** | Notifications | Simple, customizable toast notifications |

### 2.3 Data Management

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **TanStack Query v5** | Server State | Caching, background updates, optimistic updates |
| **React Hook Form** | Form Handling | Performance, validation, minimal re-renders |
| **Zod** | Schema Validation | TypeScript-first, works great with React Hook Form |
| **Axios** | HTTP Client | Interceptors, request/response transforms |

### 2.4 Tables & Data Display

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **TanStack Table v8** | Data Tables | Headless, full control, sorting/filtering/pagination |
| **date-fns** | Date Handling | Lightweight, tree-shakeable date utilities |

### 2.5 Development Tools

| Technology | Purpose |
|------------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Vitest** | Unit/Integration testing |
| **Playwright** | E2E testing |
| **React DevTools** | Debugging |

---

## 3. Development Environment Setup

### 3.1 Required Cursor IDE Extensions

Install these extensions in Cursor IDE for optimal development experience:

#### Essential Extensions (Must Have)

| Extension | ID | Purpose |
|-----------|----|---------||
| **ESLint** | `dbaeumer.vscode-eslint` | JavaScript/TypeScript linting |
| **Prettier** | `esbenp.prettier-vscode` | Code formatting |
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Tailwind autocomplete & hover |
| **TypeScript Vue Plugin (Volar)** | `Vue.volar` | Better TypeScript support |
| **ES7+ React/Redux Snippets** | `dsznajder.es7-react-js-snippets` | React code snippets |

#### Highly Recommended

| Extension | ID | Purpose |
|-----------|----|---------||
| **Auto Rename Tag** | `formulahendry.auto-rename-tag` | Auto-rename paired HTML/JSX tags |
| **Error Lens** | `usernamehw.errorlens` | Inline error display |
| **Import Cost** | `wix.vscode-import-cost` | Show import sizes |
| **Path Intellisense** | `christian-kohler.path-intellisense` | Autocomplete file paths |
| **GitLens** | `eamodio.gitlens` | Git blame & history |

#### Backend Development (Python)

| Extension | ID | Purpose |
|-----------|----|---------||
| **Python** | `ms-python.python` | Python language support |
| **Pylance** | `ms-python.vscode-pylance` | Fast Python IntelliSense |
| **Black Formatter** | `ms-python.black-formatter` | Python code formatting |

#### Testing & Debugging

| Extension | ID | Purpose |
|-----------|----|---------||
| **Playwright Test** | `ms-playwright.playwright` | Playwright test runner |
| **Thunder Client** | `rangav.vscode-thunder-client` | API testing (like Postman) |

### 3.2 Installation Command

Run this in Cursor terminal to install all extensions at once:

```bash
# Essential
cursor --install-extension dbaeumer.vscode-eslint
cursor --install-extension esbenp.prettier-vscode
cursor --install-extension bradlc.vscode-tailwindcss
cursor --install-extension dsznajder.es7-react-js-snippets

# Recommended
cursor --install-extension formulahendry.auto-rename-tag
cursor --install-extension usernamehw.errorlens
cursor --install-extension wix.vscode-import-cost
cursor --install-extension christian-kohler.path-intellisense
cursor --install-extension eamodio.gitlens

# Python/Backend
cursor --install-extension ms-python.python
cursor --install-extension ms-python.vscode-pylance
cursor --install-extension ms-python.black-formatter

# Testing
cursor --install-extension ms-playwright.playwright
cursor --install-extension rangav.vscode-thunder-client
```

### 3.3 Recommended Cursor Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "files.associations": {
    "*.css": "tailwindcss"
  }
}
```

---

## 4. Architecture Overview

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React SPA)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pages     │  │  Components │  │    State Management     │  │
│  │  (Routes)   │◄─┤  (UI Layer) │◄─┤  (TanStack Query +      │  │
│  │             │  │             │  │   React Context)        │  │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘  │
│                                                │                │
│  ┌─────────────────────────────────────────────▼─────────────┐  │
│  │                     API Layer (Axios)                     │  │
│  │           - Request/Response interceptors                 │  │
│  │           - Authentication token handling                 │  │
│  │           - Error transformation                          │  │
│  └──────────────────────────────────────────────┬────────────┘  │
└─────────────────────────────────────────────────┼───────────────┘
                                                  │ HTTP/HTTPS
┌─────────────────────────────────────────────────▼───────────────┐
│                     BACKEND (FastAPI)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /auth/*        - Authentication (JWT tokens)            │   │
│  │  /admin/*       - Admin user management (RSA signed)     │   │
│  │  /types/*       - Lookup tables (sex, events, media)     │   │
│  │  /individuals/* - Individual CRUD                        │   │
│  │  /families/*    - Family CRUD                            │   │
│  │  /events/*      - Event CRUD                             │   │
│  │  /media/*       - Media CRUD + file upload               │   │
│  │  /export/*      - GEDCOM export + ZIP download           │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                     DATABASE (SQLite)                           │
│                datasets/auth.sqlite       ← Global auth database   │
│                datasets/<owner_id>/data.sqlite  ← Owner data      │
│                datasets/<owner_id>/media/       ← Owner media     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Folder Structure

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/                    # API client and endpoints
│   │   ├── client.ts           # Axios instance with interceptors
│   │   ├── auth.ts             # Authentication API
│   │   ├── types.ts            # Lookup tables API (sex, events, media types)
│   │   ├── individuals.ts      # Individuals API
│   │   ├── families.ts         # Families API
│   │   ├── events.ts           # Events API
│   │   ├── media.ts            # Media API
│   │   └── export.ts           # Export API
│   │
│   ├── components/             # Reusable UI components
│   │   ├── common/             # Generic components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   └── ...
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Layout.tsx
│   │   ├── individuals/        # Individual-specific components
│   │   ├── families/           # Family-specific components
│   │   ├── events/             # Event-specific components
│   │   └── media/              # Media-specific components
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useIndividuals.ts
│   │   ├── useFamilies.ts
│   │   └── ...
│   │
│   ├── pages/                  # Page components (routes)
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── SetPasswordPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── individuals/
│   │   │   ├── IndividualsListPage.tsx
│   │   │   ├── IndividualDetailPage.tsx
│   │   │   └── IndividualEditPage.tsx
│   │   ├── families/
│   │   │   ├── FamiliesListPage.tsx
│   │   │   ├── FamilyDetailPage.tsx
│   │   │   └── FamilyEditPage.tsx
│   │   ├── tables/
│   │   │   └── BulkEditPage.tsx
│   │   └── export/
│   │       └── ExportPage.tsx
│   │
│   ├── contexts/               # React Context providers
│   │   └── AuthContext.tsx
│   │
│   ├── types/                  # TypeScript type definitions
│   │   ├── api.ts              # API response types
│   │   ├── models.ts           # Domain model types
│   │   └── forms.ts            # Form types
│   │
│   ├── utils/                  # Utility functions
│   │   ├── dates.ts
│   │   ├── validation.ts
│   │   └── formatting.ts
│   │
│   ├── App.tsx                 # Root component
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## 5. User Authentication Scheme

### 5.1 Authentication Flow Overview

**Manual viewer registration** where Admin personally registers viewers, and they then set their own password:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                            │
└─────────────────────────────────────────────────────────────────┘

    ADMIN                              SYSTEM                    USER
      │                                   │                        │
      │  1. Create viewer via Web Admin   │                        │
      │   (viewer_id, email)              │                        │
      ├──────────────────────────────────►│                        │
      │                                   │                        │
      │  2. System generates invitation   │                        │
      │     link with secure token        │                        │
      │◄──────────────────────────────────┤                        │
      │                                   │                        │
      │  3. Share link with viewer        │                        │
      │   (email/WhatsApp/Telegram/etc)   │                        │
      ├───────────────────────────────────┼───────────────────────►│
      │                                   │                        │
      │                                   │  4. Click invitation   │
      │                                   │◄───────────────────────┤
      │                                   │                        │
      │                                   │  5. Show password form │
      │                                   ├───────────────────────►│
      │                                   │                        │
      │                                   │  6. Submit new password│
      │                                   │◄───────────────────────┤
      │                                   │                        │
      │                                   │  7. Account activated  │
      │                                   ├───────────────────────►│
```

### 5.2 Password Reset Flow

When a viewer forgets their password:
1. User contacts Admin (you)
2. Admin opens Web Admin Panel
3. Admin clicks "Regenerate Invitation Link" for that user
4. Admin shares new link with user
5. User sets new password via the link

### 5.3 Authentication Components

#### Backend Changes Required

```python
# Authentication endpoints (new router: backend/api/auth.py)
POST /auth/login              # Login with viewer_id/password → JWT token
POST /auth/logout             # Logout (invalidate token)
POST /auth/set-password       # Set password (with invitation token)
GET  /auth/me                 # Get current viewer info

# Admin endpoints (new router: backend/api/admin.py) - secured with public key
POST /admin/viewers             # Create new viewer → returns invitation link
GET  /admin/viewers             # List all viewers
PUT  /admin/viewers/{id}/reset  # Regenerate invitation link
DELETE /admin/viewers/{id}      # Delete viewer
```

#### Database Schema - Global Auth Database

**Design Decision:** Authentication data is stored in a **separate global database** under the `datasets/` folder (`datasets/auth.sqlite`), NOT in each owner's `data.sqlite`. This is because:

1. The `data.sqlite` is owner-specific genealogy data
2. Authentication needs to work BEFORE we know which owner's database to access
3. Admin needs to manage all viewers from one place
4. Keeps all data folders under `datasets/`

```
project_root/
└── datasets/
    ├── auth.sqlite          ← Global authentication database (NEW)
    ├── admin_public.pem     ← Admin public key for signature verification
    ├── inovoseltsev/
    │   ├── data.sqlite      ← Owner genealogy data
    │   └── media/
    └── john/
        ├── data.sqlite
        └── media/
```

#### Auth Database Schema (`datasets/auth.sqlite`)

```sql
-- Global authentication table
CREATE TABLE IF NOT EXISTS auth_viewers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT UNIQUE NOT NULL,         -- Must match folder name in datasets/
    email TEXT,
    password_hash TEXT,                   -- bcrypt hash, NULL until password set
    invitation_token TEXT,                -- One-time token for password setup
    invitation_expires_at TEXT,           -- Token expiration (ISO format)
    is_active BOOLEAN DEFAULT FALSE,      -- TRUE after password is set
    is_admin BOOLEAN DEFAULT FALSE,       -- TRUE for admin viewers
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);
```

#### Admin Authentication - Public Key Cryptography

Instead of simple API keys, we use **public key cryptography** for admin authentication:

**How it works:**
1. During setup, generate a **key pair** (private + public key)
2. **Private key** stays with Admin (never uploaded to server)
3. **Public key** is stored on server (`datasets/admin_public.pem`)
4. Admin signs requests with private key, server verifies with public key

```
┌─────────────────────────────────────────────────────────────────┐
│                 ADMIN AUTHENTICATION FLOW                        │
└─────────────────────────────────────────────────────────────────┘

    ADMIN (has private key)              SERVER (has public key)
         │                                       │
         │  1. Create request payload            │
         │     (e.g., create viewer)             │
         │                                       │
         │  2. Sign payload with PRIVATE key     │
         │     signature = sign(payload, privkey)│
         │                                       │
         │  3. Send: payload + signature         │
         ├──────────────────────────────────────►│
         │                                       │
         │                    4. Verify signature│
         │                       with PUBLIC key │
         │                       verify(payload, │
         │                         signature,    │
         │                         pubkey)       │
         │                                       │
         │  5. If valid: process request         │
         │◄──────────────────────────────────────┤
```

**Setup commands (one-time):**
```bash
# Generate key pair (Admin keeps private key safe!)
openssl genrsa -out admin_private.pem 2048
openssl rsa -in admin_private.pem -pubout -out admin_public.pem

# Copy public key to server
cp admin_public.pem datasets/admin_public.pem

# Private key stays with Admin (NEVER upload to server!)
# Store admin_private.pem securely (USB drive, password manager, etc.)
```

**Note:** The `meta_header` table in owner's `data.sqlite` stores GEDCOM metadata (submitter info, etc.) and remains separate from authentication.

### 5.4 Token-Based Authentication (JWT)

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

    USER                           FRONTEND                    BACKEND
      │                               │                           │
      │  1. Enter credentials         │                           │
      ├──────────────────────────────►│                           │
      │                               │                           │
      │                               │  2. POST /auth/login      │
      │                               ├──────────────────────────►│
      │                               │                           │
      │                               │  3. Validate credentials  │
      │                               │                           │
      │                               │  4. Return JWT token      │
      │                               │◄──────────────────────────┤
      │                               │                           │
      │                               │  5. Store in localStorage │
      │                               │                           │
      │  6. Redirect to Dashboard     │                           │
      │◄──────────────────────────────┤                           │
```

### 5.5 Security Considerations

| Aspect | Implementation |
|--------|----------------|
| **Password Storage** | bcrypt hash with salt (never plain text) |
| **JWT Tokens** | Short expiration (1 hour), refresh token pattern |
| **Token Storage** | localStorage (simpler for SPA) |
| **HTTPS** | Required in production |
| **CORS** | Strict origin checking |
| **Rate Limiting** | Prevent brute-force attacks on login |
| **Admin Panel Security** | API key authentication (generated at setup) |

### 5.6 Web Admin Panel

The admin panel provides a web interface for user management:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔐 ADMIN PANEL                                    [Logout]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USER MANAGEMENT                                 [+ Add User]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Username      │ Email           │ Status    │ Actions      ││
│  ├───────────────┼─────────────────┼───────────┼──────────────┤│
│  │ inovoseltsev  │ ivan@mail.com   │ ✅ Active │ 🔄 ⚙️ 🗑️   ││
│  │ john          │ john@mail.com   │ ⏳ Pending│ 🔄 ⚙️ 🗑️   ││
│  │ mary          │ mary@mail.com   │ ✅ Active │ 🔄 ⚙️ 🗑️   ││
│  └───────────────┴─────────────────┴───────────┴──────────────┘│
│                                                                │
│  🔄 = Regenerate invitation link                                │
│  ⚙️ = Edit user                                                 │
│  🗑️ = Delete user                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Access:** Admin panel is accessed via `/admin` route and requires:
1. Valid admin API key (generated during initial setup)
2. The key is stored securely and used to authenticate admin requests

---

## 6. Application Pages & Navigation

### 6.1 Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  PUBLIC ROUTES (No authentication required)                     │
├─────────────────────────────────────────────────────────────────┤
│  /login                 - Login page                            │
│  /set-password/:token   - Password setup page (invitation link) │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  PROTECTED ROUTES (Authentication required)                     │
├─────────────────────────────────────────────────────────────────┤
│  /                      - Dashboard (statistics & quick actions)│
│                                                                 │
│  /individuals           - Individuals list (table view)         │
│  /individuals/new       - Create new individual                 │
│  /individuals/:id       - View individual (with events & media) │
│  /individuals/:id/edit  - Edit individual (with events & media) │
│                                                                 │
│  /families              - Families list (table view)            │
│  /families/new          - Create new family                     │
│  /families/:id          - View family (with events & media)     │
│  /families/:id/edit     - Edit family (with events & media)     │
│                                                                 │
│  /bulk-edit/individuals - Bulk edit individuals (table mode)    │
│  /bulk-edit/families    - Bulk edit families (table mode)       │
│                                                                 │
│  /export                - Export data (GEDCOM + media ZIP)      │
│                                                                 │
│  /settings              - User settings                         │
│  /settings/header       - GEDCOM header metadata                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ADMIN ROUTES (Admin API key required)                          │
├─────────────────────────────────────────────────────────────────┤
│  /admin                 - Admin login                           │
│  /admin/viewers         - Viewer management                     │
└─────────────────────────────────────────────────────────────────┘
```

**Design Decision:** Events and Media are NOT standalone pages. They are embedded within Individual and Family pages for a more intuitive workflow. Viewers manage events and media in the context of the person or family they belong to.

### 6.2 Navigation Design

```
┌───────────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                     ┌─────────────┐  │
│  │  LOGO   │    🏠 Dashboard                     │ 👤 Username │  │
│  │  🌳     │                                     │   [Logout]  │  │
│  └─────────┘                                     └─────────────┘  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐  │
│  │              │  │                                          │  │
│  │  SIDEBAR     │  │           MAIN CONTENT AREA              │  │
│  │              │  │                                          │  │
│  │  ──────────  │  │                                          │  │
│  │              │  │                                          │  │
│  │  📊 Dashboard│  │                                          │  │
│  │              │  │                                          │  │
│  │  👤 Individ. │  │                                          │  │
│  │              │  │                                          │  │
│  │  👨‍👩‍👧 Families│  │                                          │  │
│  │              │  │                                          │  │
│  │  ──────────  │  │                                          │  │
│  │              │  │                                          │  │
│  │  📝 Bulk Edit│  │  (Events & Media are embedded            │  │
│  │    ├ Individ.│  │   in Individual & Family pages)          │  │
│  │    └ Families│  │                                          │  │
│  │              │  │                                          │  │
│  │  📤 Export   │  │                                          │  │
│  │              │  │                                          │  │
│  │  ⚙️ Settings │  │                                          │  │
│  │              │  │                                          │  │
│  └──────────────┘  └──────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### 6.3 Proposed Pages (Detailed)

#### 6.3.1 Dashboard Page
**Purpose:** Overview of the database and quick actions

**Features:**
- Statistics cards: Total individuals, families, events, media
- Recent activity: Last 10 modified records
- Quick action buttons: Add Individual, Add Family, Export

#### 6.3.2 Individuals List Page
**Purpose:** View and manage all individuals

**Features:**
- Sortable/filterable data table
- Columns: ID, Name, Sex, Birth Date, Death Date, Actions
- Search by name
- Filter by: Sex, Living/Deceased, Has Media
- Pagination
- Actions: View, Edit, Delete

#### 6.3.3 Individual Detail/Edit Page
**Purpose:** View and modify an individual with all related data

**Features:**
- Personal information form
- Dynamic name management (add/remove names)
- Date picker with support for approximate dates (ABT, BEF, AFT)
- **Embedded Events Section:**
  - List of events (birth, death, education, work, etc.)
  - Add/edit/delete events inline
  - Event timeline visualization
- **Embedded Media Section:**
  - Media gallery with thumbnails
  - Drag-and-drop upload
  - Link existing media or upload new
- Family connections display (parents, spouses, children)
- Notes
- Validation with clear error messages

```
┌───────────────────────────────────────────────────────────────────┐
│  INDIVIDUAL: John Smith                            [Save] [Back] │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ PERSONAL INFO ────────────────────────────────────────────┐  │
│  │ Given Name: [John______]  Family Name: [Smith____]         │  │
│  │ Sex: [Male ▼]  ← dropdown from lookup_sexes table          │  │
│  │ Birth: [1950-05-15] Place: [New York, USA_____]            │  │
│  │ Death: [__________] Place: [__________________]            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ EVENTS ──────────────────────────────────────── [+ Add] ──┐  │
│  │ Add: [Study Start ▼] ← dropdown from lookup_event_types    │  │
│  │ 📅 1975 - Study Start - Harvard University           [🗑️] │  │
│  │ 📅 1979 - Study End - Harvard University             [🗑️] │  │
│  │ 📅 1980 - Work Start - IBM Corporation               [🗑️] │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ MEDIA ─────────────────────────────────── [+ Upload] ─────┐  │
│  │ Type: [Photo ▼] ← dropdown from lookup_media_types         │  │
│  │ ┌─────┐ ┌─────┐ ┌─────┐                                    │  │
│  │ │ 📷  │ │ 📷  │ │ 🎬  │   Drag & drop files here          │  │
│  │ └─────┘ └─────┘ └─────┘                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ FAMILY CONNECTIONS ───────────────────────────────────────┐  │
│  │ PARENTS:                                                    │  │
│  │   • Smith Family (F0001) → [View]                          │  │
│  │                                                             │  │
│  │ FAMILIES (as spouse/partner):   ← shows ALL families       │  │
│  │   • Smith-Johnson Family (F0002) - Mary Johnson            │  │
│  │     Married: 1975-06-15 │ Children: 2 → [View]             │  │
│  │   • Smith-Williams Family (F0005) - Susan Williams         │  │
│  │     Married: 1990-03-20 │ Children: 1 → [View]             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Note:** All fields with predefined GEDCOM 5.5.1 tags use **dropdowns** populated from backend lookup tables (`lookup_sexes`, `lookup_event_types`, `lookup_media_types`, `lookup_family_roles`).

#### 6.3.4 Families List Page
**Purpose:** View and manage all families

**Features:**
- Data table with members summary
- Columns: ID, Husband, Wife, Marriage Date, Children Count, Actions
- Search and filter

#### 6.3.5 Family Detail/Edit Page
**Purpose:** View and modify a family with all related data

**Features:**
- Partners selection (link to existing individuals)
- Marriage/divorce date and place
- Children management (add/remove from family)
- **Embedded Events Section:**
  - Family events (marriage, divorce, relocation, etc.)
  - Add/edit/delete events inline
- **Embedded Media Section:**
  - Family photos/videos
  - Upload or link existing media
- Notes

#### 6.3.6 Bulk Edit Page (Table Mode)
**Purpose:** Spreadsheet-like editing for mass data entry

**Features:**
- **Search/Filter box** above table to quickly find individuals
- Excel-like grid interface
- Inline editing
- Tab navigation between cells
- **Create Family from Selection:**
  - Select multiple individuals with checkboxes
  - Click "Create Family" button
  - Opens Family form with selected individuals as members
  - Choose role (husband/wife/partner) for each member
- Batch delete (delete multiple selected rows)
- Undo/redo

```
┌─────────────────────────────────────────────────────────────────┐
│  BULK EDIT - INDIVIDUALS                       [Save All]       │
├─────────────────────────────────────────────────────────────────┤
│  [+ Add Row]  [Delete Selected]  [👨‍👩‍👧 Create Family from Selected] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔍 Search: [_________________]  Filter: [All ▼] [Sex ▼]       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │☑│ ID  │ Given Name │ Family Name │ Sex │ Birth Date │ 📷   ││
│  ├─┼─────┼────────────┼─────────────┼─────┼────────────┼───────┤│
│  │☑│I0001│ John       │ Smith       │ M   │ 1950-05-15 │ 3    ││
│  ├─┼─────┼────────────┼─────────────┼─────┼────────────┼───────┤│
│  │☑│I0002│ Mary       │ Johnson     │ F   │ 1952-08-20 │ 2    ││
│  ├─┼─────┼────────────┼─────────────┼─────┼────────────┼───────┤│
│  │☐│I0003│ Robert     │ Smith       │ M   │ 1975-03-10 │ 0    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  2 selected → [👨‍👩‍👧 Create Family from Selected]                  │
│                                                                 │
│  Tip: Press Tab to move between cells, Enter to save row        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** The 📷 column shows media count for quick reference. Full media management is in the Individual detail page.

#### 6.3.7 Export Page
**Purpose:** Export database as GEDCOM + media

**Features:**
- Export options: GEDCOM only or GEDCOM + Media ZIP
- Preview of what will be exported (counts)
- Download progress indicator
- Download ZIP file

#### 6.3.8 Settings Page
**Purpose:** User and database settings

**Features:**
- GEDCOM header metadata editor (submitter info, etc.)
- Change password
- User profile (display name, email)

---

## 7. Data Management Modes

### 7.1 Mode 1: Individual/Family Mode (Detail Editing)

This mode is for **careful, detailed work** on specific records, including events and media.

```
┌─────────────────────────────────────────────────────────────────┐
│                 INDIVIDUAL EDIT FORM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Personal Information                                           │
│  ─────────────────────                                          │
│                                                                 │
│  GEDCOM ID: [I0001____]  (auto-generated if empty)              │
│                                                                 │
│  Sex: ○ Male  ○ Female  ○ Unknown                               │
│                                                                 │
│  Names                                            [+ Add Name]  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Type: [Primary ▼]                                         │  │
│  │ Given Name: [John_____________]                           │  │
│  │ Family Name: [Smith____________]                          │  │
│  │ Prefix: [__________________]  Suffix: [Jr._____________]  │  │
│  │                                                     [🗑️]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Birth                                                          │
│  ─────                                                          │
│  Date: [1950-05-15______]  ☐ Approximate: [_______________]    │
│  Place: [New York, NY, USA____________________________________] │
│                                                                 │
│  Death                                                          │
│  ─────                                                          │
│  Date: [________________]  ☐ Approximate: [_______________]    │
│  Place: [_____________________________________________________] │
│                                                                 │
│  Events                                          [+ Add Event]  │
│  ──────                                                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📅 1975 - STUD_START - Harvard University       [✏️][🗑️] │  │
│  │ 📅 1979 - STUD_END - Harvard University         [✏️][🗑️] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Media                                          [+ Upload]      │
│  ─────                                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐                                        │
│  │ 📷  │ │ 📷  │ │ 📷  │  Drop files here or click to upload   │
│  └─────┘ └─────┘ └─────┘                                        │
│                                                                 │
│  Notes                                                          │
│  ─────                                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│                                [Cancel]  [Save & Continue]      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Mode 2: Table Mode (Bulk Editing)

This mode is for **fast data entry** and **batch modifications**.

```
┌─────────────────────────────────────────────────────────────────┐
│  BULK EDIT - INDIVIDUALS                       [Save All]       │
├─────────────────────────────────────────────────────────────────┤
│  [+ Add Row]  [Delete Selected]  [👨‍👩‍👧 Create Family]             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │☐│ ID  │ Given Name │ Family Name │ Sex │ Birth Date │ 📷   ││
│  ├─┼─────┼────────────┼─────────────┼─────┼────────────┼───────┤│
│  │☑│I0001│ John       │ Smith       │ M   │ 1950-05-15 │ 3    ││
│  ├─┼─────┼────────────┼─────────────┼─────┼────────────┼───────┤│
│  │☑│I0002│ Mary       │ Johnson     │ F   │ 1952-08-20 │ 2    ││
│  ├─┼─────┼────────────┼─────────────┼─────┼────────────┼───────┤│
│  │☐│I0003│ [________] │ [_________] │ [▼] │ [________] │      ││  ← New row
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  2 selected → [👨‍👩‍👧 Create Family] opens Family page with members │
│                                                                 │
│  Tip: Press Tab to move between cells, Enter to save row        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features of Table Mode:**
- Inline editing (click cell to edit)
- Tab navigation between cells
- Auto-save on row blur
- Keyboard shortcuts (Ctrl+S to save all)
- Visual indication of changed cells
- Validation errors shown inline
- Undo/redo support
- **Create Family shortcut:** Select multiple individuals → Create Family → Opens Family page with selected individuals pre-loaded as members
- Media count column (📷) for quick reference - full media editing in detail mode

---

## 8. Component Design

### 8.1 Core Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `Button` | Primary action trigger | variant, size, disabled, loading |
| `Input` | Text input field | type, label, error, placeholder |
| `Select` | Dropdown selection | options, value, onChange, multiple |
| `DatePicker` | Date input with calendar | value, onChange, allowApproximate |
| `Modal` | Dialog overlay | isOpen, onClose, title, children |
| `Table` | Data table with sorting/filtering | data, columns, onRowClick |
| `Pagination` | Page navigation | total, page, perPage, onChange |
| `Card` | Content container | title, children, actions |
| `Badge` | Status indicator | variant, children |
| `Spinner` | Loading indicator | size |
| `Toast` | Notification message | type, message, duration |

### 8.2 Domain-Specific Components

| Component | Purpose |
|-----------|---------|
| `IndividualCard` | Compact individual display |
| `IndividualForm` | Individual create/edit form |
| `IndividualName` | Name display/edit sub-form |
| `FamilyCard` | Compact family display |
| `FamilyForm` | Family create/edit form |
| `FamilyMemberSelector` | Select individuals for family |
| `EventForm` | Event create/edit form |
| `EventTimeline` | Chronological event display |
| `MediaUploader` | Drag-and-drop file upload |
| `MediaGallery` | Grid of media thumbnails |
| `MediaViewer` | Lightbox media preview |
| `ApproximateDateInput` | Special date input supporting GEDCOM modifiers |
| `PersonSelector` | Searchable individual dropdown |

### 8.3 Approximate Date Component

GEDCOM supports approximate dates like "ABT 1970", "BEF 15 MAY 1980", "AFT 2000". 
We need a special component for this:

```
┌─────────────────────────────────────────────────────────────────┐
│  APPROXIMATE DATE INPUT                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mode: ○ Exact  ○ Approximate                                   │
│                                                                  │
│  If Exact:                                                       │
│  ┌───────────────────┐                                          │
│  │ 📅 1950-05-15     │  (standard date picker)                  │
│  └───────────────────┘                                          │
│                                                                  │
│  If Approximate:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Modifier: [ABT ▼]  Year: [1950]  Month: [May ▼]  Day: [__] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Modifiers:                                                      │
│  - ABT (About)        - approximately this date                 │
│  - BEF (Before)       - before this date                        │
│  - AFT (After)        - after this date                         │
│  - BET...AND...       - between two dates                       │
│  - EST (Estimated)    - estimated date                          │
│  - CAL (Calculated)   - calculated from other data              │
│                                                                  │
│  Preview: "ABT MAY 1950"                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. State Management

### 9.1 State Categories

| Category | Solution | Examples |
|----------|----------|----------|
| **Server State** | TanStack Query | Individuals list, family details, API data |
| **Auth State** | React Context | Current user, login status, permissions |
| **UI State** | Local React State | Modal open/close, form values, selected rows |
| **URL State** | React Router | Current page, filters, sort order |

### 9.2 TanStack Query Setup

```typescript
// Query keys structure
const queryKeys = {
  individuals: {
    all: ['individuals'] as const,
    list: (filters: IndividualFilters) => ['individuals', 'list', filters] as const,
    detail: (id: number) => ['individuals', 'detail', id] as const,
  },
  families: {
    all: ['families'] as const,
    list: (filters: FamilyFilters) => ['families', 'list', filters] as const,
    detail: (id: number) => ['families', 'detail', id] as const,
  },
  // ... similar for events, media
};

// Example hook
function useIndividuals(filters: IndividualFilters) {
  return useQuery({
    queryKey: queryKeys.individuals.list(filters),
    queryFn: () => api.individuals.list(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### 9.3 Optimistic Updates

For better UX, we'll implement optimistic updates:

```typescript
function useDeleteIndividual() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => api.individuals.delete(id),
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.individuals.all });
      
      // Snapshot previous value
      const previous = queryClient.getQueryData(queryKeys.individuals.all);
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.individuals.all, (old) => 
        old?.filter(ind => ind.id !== id)
      );
      
      return { previous };
    },
    onError: (err, id, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.individuals.all, context?.previous);
      toast.error('Failed to delete individual');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.individuals.all });
    },
  });
}
```

---

## 10. API Integration

### 10.1 API Client Setup

```typescript
// src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 10.2 Multi-User API Architecture

**Critical Design:** Multiple viewers may edit owner datasets simultaneously. The backend must know WHICH owner's database to access for each request.

#### How Viewer Context is Passed

```
┌─────────────────────────────────────────────────────────────────┐
│               VIEWER CONTEXT IN API REQUESTS                     │
└─────────────────────────────────────────────────────────────────┘

  1. Viewer logs in → receives JWT token containing owner_id
  
  2. JWT Token payload:
     {
       "sub": "inovoseltsev",     ← owner_id
       "exp": 1735500000,         ← expiration
       "iat": 1735496400          ← issued at
     }
  
  3. Every API request includes token in header:
     Authorization: Bearer <jwt_token>
  
  4. Backend extracts owner_id from token:
     owner_id = decode_jwt(token)["sub"]
  
  5. Backend uses correct database:
     db_path = f"datasets/{owner_id}/data.sqlite"
```

#### Backend Changes Required

```python
# backend/api/dependencies.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
import jwt

security = HTTPBearer()

def get_current_viewer(credentials = Depends(security)) -> str:
    """Extract viewer id from JWT token."""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        viewer_id = payload.get("sub")
        if not viewer_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return viewer_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_owner_db(owner_id: str = Depends(get_current_viewer)) -> Session:
    """Get database session for the resolved owner."""
    owner_info = OwnerInfo(owner_id=owner_id)
    engine = create_engine(f"sqlite:///{owner_info.db_file}")
    Session = sessionmaker(bind=engine)
    return Session()

# Usage in API endpoints:
@router.get("/individuals")
def list_individuals(db: Session = Depends(get_owner_db)):
    # db is automatically the correct owner's database!
    return db.query(Individual).all()
```

### 10.3 API Endpoints Mapping

| Frontend | Backend Endpoint | Method |
|----------|------------------|--------|
| `api.individuals.list(params)` | `/individuals?skip=X&limit=Y` | GET |
| `api.individuals.get(id)` | `/individuals/{id}` | GET |
| `api.individuals.create(data)` | `/individuals` | POST |
| `api.individuals.update(id, data)` | `/individuals/{id}` | PUT |
| `api.individuals.delete(id)` | `/individuals/{id}` | DELETE |
| `api.families.list(params)` | `/families?skip=X&limit=Y` | GET |
| `api.families.get(id)` | `/families/{id}` | GET |
| `api.families.create(data)` | `/families` | POST |
| `api.families.update(id, data)` | `/families/{id}` | PUT |
| `api.families.delete(id)` | `/families/{id}` | DELETE |
| `api.events.list(params)` | `/events?individual_id=X&family_id=Y` | GET |
| `api.events.create(data)` | `/events` | POST |
| `api.events.update(id, data)` | `/events/{id}` | PUT |
| `api.events.delete(id)` | `/events/{id}` | DELETE |
| `api.media.list(params)` | `/media?individual_id=X&family_id=Y` | GET |
| `api.media.upload(file, meta)` | `/media/upload` | POST (multipart) |
| `api.media.delete(id)` | `/media/{id}` | DELETE |
| `api.export.gedcom()` | `/export/gedcom` | GET |
| `api.export.zip()` | `/export/zip` | GET |
| **Lookup Tables (no auth)** | | |
| `api.types.sex()` | `/types/sex` | GET |
| `api.types.events()` | `/types/events` | GET |
| `api.types.media()` | `/types/media` | GET |
| `api.types.familyRoles()` | `/types/family-roles` | GET |

### 10.4 GEDCOM Lookup Tables

The backend already has lookup tables for predefined GEDCOM 5.5.1 tags. These are exposed via API for the frontend to populate dropdowns:

```sql
-- Already in schema.sql:
lookup_sexes        -- M, F, NB, U
lookup_event_types  -- BIRT, DEAT, MARR, DIV, BAPM, CHR, ADOP, EVEN, STUD_START, etc.
lookup_media_types  -- photo, audio, video
lookup_family_roles -- husband, wife, partner
```

#### New API Endpoints for Lookup Tables

```python
# backend/api/types.py
from fastapi import APIRouter

router = APIRouter(prefix="/types", tags=["types"])

@router.get("/sex")
def get_sex_types(db: Session = Depends(get_db)):
    """Get all sex types for dropdown."""
    return db.execute(text("SELECT code, description FROM lookup_sexes")).fetchall()

@router.get("/events")
def get_event_types(db: Session = Depends(get_db)):
    """Get all event types for dropdown."""
    return db.execute(text("SELECT code, description FROM lookup_event_types")).fetchall()

@router.get("/media")
def get_media_types(db: Session = Depends(get_db)):
    """Get all media types for dropdown."""
    return db.execute(text("SELECT code, description FROM lookup_media_types")).fetchall()

@router.get("/family-roles")
def get_family_roles(db: Session = Depends(get_db)):
    """Get all family member roles for dropdown."""
    return db.execute(text("SELECT code, description FROM lookup_family_roles")).fetchall()
```

**Frontend Usage:**
```typescript
// Fetch once on app load, cache in React Query
const { data: eventTypes } = useQuery({
  queryKey: ['types', 'events'],
  queryFn: () => api.types.events(),
  staleTime: Infinity, // Never refetch - these don't change
});

// Use in dropdown
<select>
  {eventTypes?.map(t => (
    <option key={t.code} value={t.code}>{t.description}</option>
  ))}
</select>
```

### 10.5 Data Binding Constraints

**Important Backend Requirement:** Events and Media MUST be bound to either an Individual OR a Family.

This constraint must be enforced at:
1. **Database level** (schema.sql) - CHECK constraint
2. **Backend level** (API validation) - Pydantic schemas
3. **Frontend level** (form validation) - Zod schemas

#### Database Schema Update Required

```sql
-- Update main_events table to require binding
CREATE TABLE IF NOT EXISTS main_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  individual_id INTEGER REFERENCES main_individuals(id),
  family_id INTEGER REFERENCES main_families(id),
  event_type_code TEXT REFERENCES lookup_event_types(code),
  event_date TEXT,
  event_date_approx TEXT,
  event_place TEXT,
  description TEXT,
  -- Constraint: must have either individual_id OR family_id (not both, not neither)
  CHECK ((individual_id IS NOT NULL AND family_id IS NULL) OR 
         (individual_id IS NULL AND family_id IS NOT NULL))
);

-- Update main_media table to require binding
CREATE TABLE IF NOT EXISTS main_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  individual_id INTEGER REFERENCES main_individuals(id),
  family_id INTEGER REFERENCES main_families(id),
  file_path TEXT,
  media_type_code TEXT REFERENCES lookup_media_types(code),
  media_date TEXT,
  media_date_approx TEXT,
  description TEXT,
  -- Constraint: must have either individual_id OR family_id (not both, not neither)
  CHECK ((individual_id IS NOT NULL AND family_id IS NULL) OR 
         (individual_id IS NULL AND family_id IS NOT NULL))
);
```

#### Backend Validation (Pydantic)

```python
from pydantic import model_validator

class EventCreate(EventBase):
    @model_validator(mode='after')
    def check_binding(self):
        if self.individual_id is None and self.family_id is None:
            raise ValueError('Event must be linked to an individual or family')
        if self.individual_id is not None and self.family_id is not None:
            raise ValueError('Event cannot be linked to both individual and family')
        return self
```

#### Frontend Validation (Zod)

```typescript
const eventSchema = z.object({
  individual_id: z.number().nullable(),
  family_id: z.number().nullable(),
  // ... other fields
}).refine(
  (data) => (data.individual_id !== null) !== (data.family_id !== null),
  { message: "Event must be linked to exactly one: individual or family" }
);
```

### 10.6 New Backend Endpoints Needed

The current backend needs these additions:

```python
# Authentication (new router: backend/api/auth.py)
POST /auth/login           # Returns JWT token
POST /auth/logout          # Invalidate token
POST /auth/set-password    # Set password with invitation token
GET  /auth/me              # Get current viewer info

# Lookup types (new router: backend/api/types.py)
GET  /types/sex            # Sex codes for dropdown
GET  /types/events         # Event types for dropdown
GET  /types/media          # Media types for dropdown
GET  /types/family-roles   # Family member roles for dropdown

# Media file upload (enhance backend/api/media.py)
POST /media/upload         # Multipart form upload, saves to owner's media folder
GET  /media/{id}/file      # Serve the actual file

# Export (new router: backend/api/export.py)
GET  /export/gedcom        # Export GEDCOM file (uses gedcom_export.py)
GET  /export/zip           # Export GEDCOM + media as ZIP

# Admin (new router: backend/api/admin.py) - secured with public key signature
POST /admin/viewers          # Create viewer → returns invitation link
GET  /admin/viewers          # List viewers
PUT  /admin/viewers/{id}/reset  # Regenerate invitation link
DELETE /admin/viewers/{id}   # Delete viewer
```

---

## 11. Media Management

### 11.1 Upload Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MEDIA UPLOAD FLOW                             │
└─────────────────────────────────────────────────────────────────┘

    USER                           FRONTEND                    BACKEND
      │                               │                           │
      │  1. Select/drop files         │                           │
      ├──────────────────────────────►│                           │
      │                               │                           │
      │                               │  2. Validate file type    │
      │                               │     & size                │
      │                               │                           │
      │  3. Show preview + form       │                           │
      │◄──────────────────────────────┤                           │
      │                               │                           │
      │  4. Fill metadata             │                           │
      │     (description, date,       │                           │
      │      linked person/family)    │                           │
      ├──────────────────────────────►│                           │
      │                               │                           │
      │                               │  5. POST /media/upload    │
      │                               │     (multipart/form-data) │
      │                               ├──────────────────────────►│
      │                               │                           │
      │                               │  6. Save to user's        │
      │                               │     media folder          │
      │                               │                           │
      │                               │  7. Create DB record      │
      │                               │◄──────────────────────────┤
      │                               │                           │
      │  8. Show success + thumbnail  │                           │
      │◄──────────────────────────────┤                           │
```

### 11.2 Supported File Types

| Type | Extensions | Max Size |
|------|------------|----------|
| **Photo** | .jpg, .jpeg, .png, .gif, .webp | 10 MB |
| **Video** | .mp4, .webm, .mov | 100 MB |
| **Audio** | .mp3, .wav, .ogg, .m4a | 20 MB |

### 11.3 Media Storage

Files are stored in `datasets/<owner_id>/media/` with unique filenames:

```
datasets/
└── inovoseltsev/
    ├── data.sqlite
    ├── data.ged
    └── media/
        ├── photo_2025_001.jpg
        ├── photo_2025_002.png
        ├── video_2025_001.mp4
        └── audio_2025_001.mp3
```

### 11.4 Media Upload Component (Embedded in Individual/Family Pages)

```
┌─────────────────────────────────────────────────────────────────┐
│  MEDIA UPLOADER                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │         📁 Drag and drop files here                       │  │
│  │                                                           │  │
│  │              or click to browse                           │  │
│  │                                                           │  │
│  │         Supported: JPG, PNG, MP4, MP3                     │  │
│  │         Max size: Photos 10MB, Videos 100MB               │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  UPLOAD QUEUE:                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🖼️ photo1.jpg        ████████████░░ 75%    [Cancel]       │  │
│  │ 🖼️ photo2.png        ██░░░░░░░░░░░░ 12%    [Cancel]       │  │
│  │ 🎬 video1.mp4        Waiting...            [Cancel]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Export Functionality

### 12.1 Export Options

```
┌─────────────────────────────────────────────────────────────────┐
│  EXPORT DATA                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Export Format: ○ GEDCOM Only (.ged)                            │
│                 ● GEDCOM + Media (.zip)                         │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  EXPORT SUMMARY                                           │  │
│  │                                                           │  │
│  │  📊 Individuals: 156                                      │  │
│  │  👨‍👩‍👧 Families: 47                                          │  │
│  │  📅 Events: 312                                           │  │
│  │  🖼️ Media files: 89 (245 MB)                              │  │
│  │                                                           │  │
│  │  Estimated ZIP size: ~250 MB                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                              [Download GEDCOM + Media]           │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  📝 Note: Large exports may take several minutes.               │
│     Do not close this page during download.                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Export Flow

```
USER                           FRONTEND                    BACKEND
  │                               │                           │
  │  1. Click "Download"          │                           │
  ├──────────────────────────────►│                           │
  │                               │                           │
  │                               │  2. GET /export/zip       │
  │                               ├──────────────────────────►│
  │                               │                           │
  │                               │  3. Generate GEDCOM       │
  │                               │     (gedcom_export.py)    │
  │                               │                           │
  │                               │  4. Create ZIP with       │
  │                               │     GEDCOM + media/       │
  │                               │                           │
  │                               │  5. Stream ZIP response   │
  │                               │◄──────────────────────────┤
  │                               │                           │
  │  6. Browser downloads file    │                           │
  │◄──────────────────────────────┤                           │
```

---

## 13. Browser Support

### 13.1 Supported Browsers

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| **Chrome** | 90+ | Primary development browser |
| **Firefox** | 88+ | Full support |
| **Safari** | 14+ | iOS and macOS |
| **Edge** | 90+ | Chromium-based |
| **Samsung Internet** | 14+ | Android default |

### 13.2 Compatibility Strategy

- Use modern JavaScript features (ES2020+) with Vite/TypeScript transpilation
- Desktop-first design (mobile support deferred)
- Use CSS custom properties with fallbacks
- Light theme only (no dark mode toggle)
- Avoid experimental/bleeding-edge features

---

## 14. Error Logging & Monitoring

### 14.1 Backend Health Logging

**Design Decision:** No personal data logging (for privacy), but comprehensive backend health monitoring using **rsyslog** (system logging).

#### What Gets Logged

| Level | What | Example |
|-------|------|---------|
| **ERROR** | Exceptions, failed operations | Database connection failed, File not found |
| **WARN** | Potential issues | Slow query (>1s), Low disk space |
| **INFO** | Key operations | Server started, Viewer logged in (viewer_id only) |

#### What Does NOT Get Logged

- Personal genealogy data (names, dates, places)
- Passwords or tokens
- Full request/response bodies
- Detailed viewer activity trails

#### Logging Implementation (using rsyslog)

**Why rsyslog?**
- System handles log rotation and archiving automatically
- No need to manage log files manually
- Centralized logging if running multiple instances
- Standard Linux logging infrastructure

```python
# backend/logging_config.py
import logging
import logging.handlers

def setup_logging():
    """Configure logging to use rsyslog."""
    
    # Create logger
    logger = logging.getLogger('genealogy')
    logger.setLevel(logging.INFO)
    
    # Use SysLogHandler to send to rsyslog
    syslog_handler = logging.handlers.SysLogHandler(
        address='/dev/log',  # Linux syslog socket
        facility=logging.handlers.SysLogHandler.LOG_LOCAL0
    )
    
    # Format: just the message, rsyslog adds timestamp
    formatter = logging.Formatter(
        '%(name)s[%(process)d]: %(levelname)s - %(message)s'
    )
    syslog_handler.setFormatter(formatter)
    
    # Also log to console during development
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    ))
    
    logger.addHandler(syslog_handler)
    logger.addHandler(console_handler)
    
    return logger

# Example usage
logger = setup_logging()

# ✅ Good - logs operation status without personal data
logger.info(f"Viewer '{viewer_id}' logged in successfully")
logger.error(f"Database query failed: {error_type}")

# ❌ Bad - would expose personal data
# logger.info(f"Created individual: {individual.given_name} {individual.family_name}")
```

#### rsyslog Configuration (optional)

To separate GEDCOM logs into their own directory, add to `/etc/rsyslog.d/gedcom.conf`:

```
# GEDCOM Database logs - separate facility for each log type
# local0 = backend application logs
# local1 = security/authentication logs (future)

$template GedcomLogFormat,"%timegenerated% %syslogtag%%msg%\n"

local0.*    /var/log/gedcom/backend.log;GedcomLogFormat
local1.*    /var/log/gedcom/security.log;GedcomLogFormat
```

Create the log directory and restart rsyslog:
```bash
sudo mkdir -p /var/log/gedcom
sudo chown syslog:adm /var/log/gedcom
sudo systemctl restart rsyslog
```

#### Log Location

- **Development:** Console output
- **Production:** System logs via rsyslog
  - Default: `/var/log/syslog` or `/var/log/messages`
  - Custom (with rsyslog config):
    - `/var/log/gedcom/backend.log` - Application logs
    - `/var/log/gedcom/security.log` - Authentication logs (future)

---

## 15. Testing Strategy

### 15.1 Testing Pyramid

```
           ┌─────────────┐
           │    E2E      │   Few, slow, high-confidence
           │ (Playwright)│   Critical user flows
           ├─────────────┤
           │ Integration │   Some, medium speed
           │   (Vitest)  │   Component + API
           ├─────────────┤
           │    Unit     │   Many, fast
           │   (Vitest)  │   Pure functions, hooks
           └─────────────┘
```

### 15.2 Test Categories

| Category | Tool | What to Test |
|----------|------|--------------|
| **Unit** | Vitest | Utility functions, hooks, validation |
| **Component** | Vitest + React Testing Library | Component rendering, interactions |
| **Integration** | Vitest + MSW | API calls, data flow |
| **E2E** | Playwright | Full user journeys |

### 15.3 Key Test Scenarios

**Authentication:**
- Login with valid credentials
- Login with invalid credentials
- Password setup flow
- Token expiration handling

**Individuals:**
- List individuals with pagination
- Create individual with names
- Update individual
- Delete individual
- Search and filter

**Families:**
- Create family with members
- Add/remove children
- Update family details

**Media:**
- Upload single file
- Upload multiple files
- Delete media
- Link media to individual

**Export:**
- Download GEDCOM file
- Download ZIP archive

---

## 16. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic project setup, authentication, and admin panel

- [ ] Initialize React + Vite + TypeScript project
- [ ] Configure Tailwind CSS (light theme)
- [ ] Set up folder structure
- [ ] Create basic layout components (Header, Sidebar, Footer)
- [ ] Create global auth database (`auth.sqlite`)
- [ ] Implement auth endpoints (login, set-password, me)
- [ ] Implement admin endpoints (create viewer, list viewers, reset invitation)
- [ ] Implement authentication context and login page
- [ ] Create Web Admin Panel (user management)
- [ ] Create protected route wrapper

**Deliverable:** Admin can create viewers, viewers can log in and see basic dashboard

### Phase 2: Core CRUD - Individual Mode (Week 3-4)
**Goal:** Full CRUD for individuals and families with embedded events & media

- [ ] Individuals list page with table
- [ ] Individual detail/edit page with:
  - [ ] Personal info form
  - [ ] Embedded events section (add/edit/delete)
  - [ ] Embedded media section (upload/delete)
  - [ ] Family connections display
- [ ] Families list page
- [ ] Family detail/edit page with:
  - [ ] Members and children management
  - [ ] Embedded events section
  - [ ] Embedded media section
- [ ] Add data binding validation (events/media must belong to individual OR family)
- [ ] Update backend schema with CHECK constraints

**Deliverable:** Viewers can manage individuals, families, events, and media

### Phase 3: Table Mode (Week 5)
**Goal:** Bulk editing capabilities with "Create Family" shortcut

- [ ] Implement editable data table component
- [ ] Bulk edit page for individuals
  - [ ] Inline editing
  - [ ] Multi-select with checkboxes
  - [ ] "Create Family from Selected" button
- [ ] Bulk edit page for families
- [ ] Batch delete operations
- [ ] Undo/redo support

**Deliverable:** Viewers can efficiently edit multiple records and create families from selected individuals

### Phase 4: Media Management (Week 6)
**Goal:** Upload and manage media files

- [ ] Add file upload endpoint to backend (multipart)
- [ ] Implement drag-and-drop uploader component
- [ ] Media viewer (lightbox/modal preview)
- [ ] Thumbnail display
- [ ] File validation (type, size)

**Deliverable:** Viewers can upload and manage photos/videos within individual/family pages

### Phase 5: Export & Polish (Week 7)
**Goal:** Export functionality and UX polish

- [ ] Add export endpoints to backend (GEDCOM, ZIP)
- [ ] Export page with options
- [ ] ZIP download with progress
- [ ] Settings page (GEDCOM header, change password)
- [ ] Dashboard statistics
- [ ] Loading states and error handling
- [ ] Backend health logging

**Deliverable:** Complete application ready for use

### Phase 6: Testing & Deployment (Week 8)
**Goal:** Production-ready application

- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment configuration

**Deliverable:** Tested, documented, deployable application

---

## 17. Design Decisions Summary

All open questions have been resolved. Here's the summary of decisions:

| Question | Decision | Notes |
|----------|----------|-------|
| **User Management** | Web Admin Panel | Secured with API key |
| **Password Reset** | Manual invitation regeneration | Admin regenerates link via Admin Panel |
| **Theme** | Light theme only | No dark mode toggle |
| **Language** | English only | No i18n infrastructure |
| **Mobile Support** | Desktop-first | Mobile deferred to future release |
| **Family Tree Visualization** | Skip for now | Use 3rd party tools with exported GEDCOM |
| **GEDCOM Import UI** | No | CLI import is sufficient |
| **Audit Log** | No personal data logging | Backend health/errors are logged |
| **Events/Media** | Embedded in Individual/Family pages | Not standalone pages |
| **Data Binding** | Required | Events/Media must belong to Individual OR Family |
| **CSV Import/Export** | Removed from bulk-edit | Not needed initially |
| **Bulk-Edit Enhancement** | "Create Family from Selected" | Added shortcut |
| **Bulk-Edit Search** | Search/filter box | Filter individuals in table |
| **Auth Database** | `datasets/auth.sqlite` | Under datasets/ folder |
| **Admin Security** | Public key cryptography | RSA key pair for admin auth |
| **Logging** | rsyslog | System handles rotation |
| **Viewer Context** | JWT contains viewer_id | Multi-viewer simultaneous access |
| **Lookup Tables** | Dropdowns from types_* tables | GEDCOM 5.5.1 compliance |

---

## 18. Postponed Features

Features explicitly deferred to future releases:

### 18.1 Visualization

| Feature | Description | Priority |
|---------|-------------|----------|
| **Family Tree Graph** | Interactive graphical family tree visualization | Medium |
| **Pedigree Chart** | Ancestor tree view (parents, grandparents, etc.) | Medium |
| **Descendant Chart** | Descendant tree view | Low |
| **Timeline View** | Visual timeline of events across family | Low |

**Workaround:** Export GEDCOM file and use third-party tools like:
- Gramps (free, open-source)
- Family Tree Builder (free)
- Online viewers

### 18.2 Import Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **GEDCOM Import via UI** | Upload .ged file through web interface | Medium |
| **CSV Import** | Import individuals/families from CSV | Low |
| **Merge Databases** | Merge two owner datasets | Low |

**Workaround:** Use CLI import: `python -m database.gedcom_import --owner owner_id file.ged`

### 18.3 Mobile Support

| Feature | Description | Priority |
|---------|-------------|----------|
| **Mobile-Optimized UI** | Touch-friendly interface | Medium |
| **Progressive Web App (PWA)** | Installable mobile app | Low |
| **Offline Support** | Work without internet connection | Low |

**Current State:** Desktop-first design works on mobile but not optimized.

### 18.4 Collaboration Features

| Feature | Description | Priority |
|---------|-------------|----------|
| **Shared Databases** | Multiple viewers editing same database | Low |
| **Change Notifications** | Email/push when data changes | Low |
| **Comments/Discussions** | Discuss individuals/families | Low |

### 18.5 Data Quality

| Feature | Description | Priority |
|---------|-------------|----------|
| **Duplicate Detection** | Find potential duplicate individuals | Medium |
| **Data Validation** | Check for inconsistencies (e.g., child older than parent) | Medium |
| **Source Citations** | Link sources to facts | Low |
| **DNA Integration** | Import/display DNA matches | Low |

### 18.6 Other

| Feature | Description | Priority |
|---------|-------------|----------|
| **Dark Theme** | Dark mode toggle | Low |
| **Multi-Language** | Russian, Hebrew, etc. | Low |
| **Reports** | Generate PDF reports | Low |
| **Audit Log** | Track who changed what | Low |
| **Bulk Import CSV** | Import from spreadsheet | Low |
| **Bulk Export CSV** | Export to spreadsheet | Low |

---

## Appendix A: Technology Glossary

For reference, here's a brief explanation of the technologies mentioned:

| Term | What It Is |
|------|------------|
| **React** | JavaScript library for building user interfaces, made by Facebook |
| **TypeScript** | JavaScript with added type checking, catches errors before running |
| **Vite** | Fast build tool that makes development quick and pleasant |
| **Tailwind CSS** | Utility-first CSS framework for rapid styling |
| **TanStack Query** | Library for fetching, caching, and updating server data |
| **TanStack Table** | Library for building powerful tables with sorting, filtering |
| **React Hook Form** | Library for building performant forms with validation |
| **Zod** | Library for defining data schemas and validation |
| **Axios** | Library for making HTTP requests to the backend |
| **JWT** | JSON Web Token - a secure way to transmit user identity |
| **Vitest** | Fast test runner that works with Vite |
| **Playwright** | Tool for testing the app in real browsers |
| **bcrypt** | Library for secure password hashing |

---

## Appendix B: Sample UI Mockups (Updated)

### B.1 Dashboard Mockup

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🌳 Genealogy DB                                           👤 John │ Logout │
├──────────────────┬───────────────────────────────────────────────────────────┤
│                  │                                                           │
│  📊 Dashboard    │  Welcome back, John!                                      │
│                  │                                                           │
│  👤 Individuals  │  ┌───────────────────────────────────────────────────┐   │
│                  │  │  DATABASE OVERVIEW                                │   │
│  👨‍👩‍👧 Families    │  │                                                    │   │
│                  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │   │
│  ───────────     │  │  │   156   │ │   47    │ │   312   │ │   89    │  │   │
│                  │  │  │ People  │ │Families │ │ Events  │ │ Photos  │  │   │
│  📝 Bulk Edit    │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘  │   │
│    ├ Individuals │  │                                                    │   │
│    └ Families    │  └───────────────────────────────────────────────────┘   │
│                  │                                                           │
│  📤 Export       │  ┌───────────────────────────────────────────────────┐   │
│                  │  │  QUICK ACTIONS                                    │   │
│  ⚙️ Settings     │  │                                                    │   │
│                  │  │  [+ Add Person]  [+ Add Family]  [📤 Export Data] │   │
│                  │  │                                                    │   │
│                  │  └───────────────────────────────────────────────────┘   │
│                  │                                                           │
│                  │  ┌───────────────────────────────────────────────────┐   │
│                  │  │  RECENT ACTIVITY                                  │   │
│                  │  │                                                    │   │
│                  │  │  • John Smith updated - 5 minutes ago             │   │
│                  │  │  • Mary Johnson created - 2 hours ago             │   │
│                  │  │  • Smith Family updated - 1 day ago               │   │
│                  │  │                                                    │   │
│                  │  └───────────────────────────────────────────────────┘   │
│                  │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

### B.2 Individuals List Mockup

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🌳 Genealogy DB                                           👤 John │ Logout │
├──────────────────┬───────────────────────────────────────────────────────────┤
│                  │                                                           │
│  📊 Dashboard    │  INDIVIDUALS                             [+ Add Person]  │
│                  │                                                           │
│  👤 Individuals ◄│  ┌───────────────────────────────────────────────────┐   │
│                  │  │  🔍 Search: [________________]   Filter: [All ▼]  │   │
│  👨‍👩‍👧 Families     │  └───────────────────────────────────────────────────┘   │
│                  │                                                           │
│  ───────────     │  ┌───────────────────────────────────────────────────┐   │
│                  │  │ ID    │ Name          │ Sex │ Birth     │ Actions│   │
│  📝 Bulk Edit    │  ├───────┼───────────────┼─────┼───────────┼────────┤   │
│    ├ Individuals │  │ I0001 │ John Smith    │ M   │ 1950-05-15│ 👁️ ✏️ 🗑️│   │
│    └ Families    │  │ I0002 │ Mary Smith    │ F   │ 1952-08-20│ 👁️ ✏️ 🗑️│   │
│                  │  │ I0003 │ Robert Smith  │ M   │ 1975-03-10│ 👁️ ✏️ 🗑️│   │
│  📤 Export       │  │ I0004 │ Sarah Johnson │ F   │ 1978-11-22│ 👁️ ✏️ 🗑️│   │
│                  │  │ I0005 │ Michael Brown │ M   │ 1980-01-05│ 👁️ ✏️ 🗑️│   │
│  ⚙️ Settings     │  └───────┴───────────────┴─────┴───────────┴────────┘   │
│                  │                                                           │
│                  │  Showing 1-10 of 156   [◄ Prev]  [1] [2] [3]  [Next ►]   │
│                  │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

### B.3 Individual Edit Page with Embedded Events & Media

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🌳 Genealogy DB                                           👤 John │ Logout │
├──────────────────┬───────────────────────────────────────────────────────────┤
│                  │                                                           │
│  📊 Dashboard    │  EDIT INDIVIDUAL                         [Save] [Back]   │
│                  │                                                           │
│  👤 Individuals ◄│  ┌─ PERSONAL INFO ─────────────────────────────────────┐ │
│                  │  │ GEDCOM ID: I0001 (auto)                             │ │
│  👨‍👩‍👧 Families     │  │ Given: [John_______]  Family: [Smith______]         │ │
│                  │  │ Sex: ● Male ○ Female ○ Unknown                      │ │
│  ───────────     │  │ Birth: [1950-05-15__] Place: [New York, USA]        │ │
│                  │  │ Death: [___________] Place: [______________]        │ │
│  📝 Bulk Edit    │  └─────────────────────────────────────────────────────┘ │
│    ├ Individuals │                                                           │
│    └ Families    │  ┌─ EVENTS ───────────────────────────────── [+ Add] ──┐ │
│                  │  │ 📅 1975 - Study Start - Harvard        [Edit][Del]  │ │
│  📤 Export       │  │ 📅 1979 - Study End - Harvard          [Edit][Del]  │ │
│                  │  │ 📅 1980 - Work Start - IBM Corp        [Edit][Del]  │ │
│  ⚙️ Settings     │  └─────────────────────────────────────────────────────┘ │
│                  │                                                           │
│                  │  ┌─ MEDIA ──────────────────────────── [+ Upload] ─────┐ │
│                  │  │ ┌─────┐ ┌─────┐ ┌─────┐                             │ │
│                  │  │ │ 📷  │ │ 📷  │ │ 🎬  │   Drop files here          │ │
│                  │  │ │photo│ │photo│ │video│                             │ │
│                  │  │ └─────┘ └─────┘ └─────┘                             │ │
│                  │  └─────────────────────────────────────────────────────┘ │
│                  │                                                           │
│                  │  ┌─ FAMILY CONNECTIONS ────────────────────────────────┐ │
│                  │  │ Parents: Smith Family (F0001) → View                │ │
│                  │  │ Spouse: Mary Johnson (I0002) → View                 │ │
│                  │  │ Children: Robert (I0005), Sarah (I0006)             │ │
│                  │  └─────────────────────────────────────────────────────┘ │
│                  │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

### B.4 Bulk Edit with "Create Family" Feature

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  🌳 Genealogy DB                                           👤 John │ Logout │
├──────────────────┬───────────────────────────────────────────────────────────┤
│                  │                                                           │
│  📊 Dashboard    │  BULK EDIT - INDIVIDUALS                     [Save All]  │
│                  │                                                           │
│  👤 Individuals  │  [+ Add Row] [Delete Selected] [👨‍👩‍👧 Create Family]       │
│                  │                                                           │
│  👨‍👩‍👧 Families    │  ┌────────────────────────────────────────────────────┐  │
│                  │  │☑│ ID   │ Given   │ Family  │ Sex │ Birth    │ 📷 │  │
│  ───────────     │  ├─┼──────┼─────────┼─────────┼─────┼──────────┼────┤  │
│                  │  │☑│I0001 │ John    │ Smith   │ M   │1950-05-15│ 3  │  │
│  📝 Bulk Edit ◄  │  ├─┼──────┼─────────┼─────────┼─────┼──────────┼────┤  │
│    ├ Individuals◄│  │☑│I0002 │ Mary    │ Johnson │ F   │1952-08-20│ 2  │  │
│    └ Families    │  ├─┼──────┼─────────┼─────────┼─────┼──────────┼────┤  │
│                  │  │☐│I0003 │ Robert  │ Smith   │ M   │1975-03-10│ 0  │  │
│  📤 Export       │  ├─┼──────┼─────────┼─────────┼─────┼──────────┼────┤  │
│                  │  │☐│I0004 │ [_____] │ [_____] │ [▼] │[________]│    │  │
│  ⚙️ Settings     │  └────────────────────────────────────────────────────┘  │
│                  │                                                           │
│                  │  ┌───────────────────────────────────────────────────┐   │
│                  │  │ ✓ 2 selected                                      │   │
│                  │  │ [👨‍👩‍👧 Create Family from Selected] → Opens family   │   │
│                  │  │     form with I0001 (John) and I0002 (Mary)       │   │
│                  │  └───────────────────────────────────────────────────┘   │
│                  │                                                           │
│                  │  Tip: Tab between cells, Enter to save row, Ctrl+S all   │
│                  │                                                           │
└──────────────────┴───────────────────────────────────────────────────────────┘
```

---

**Document End**

*Version 1.2 - December 28, 2025*
*Status: Approved for Implementation*
*All design decisions finalized based on stakeholder feedback.*

