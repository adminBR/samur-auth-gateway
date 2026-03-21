# Frontend Design Structure

## Purpose

This document describes the current frontend structure, visual organization, and domain boundaries for the authentication and indicators portal. It is intended to be a stable reference for developers and future agents working on the frontend.

## Frontend Scope

The frontend is organized around four main concerns:

- application entry and routing
- pages
- user-facing dashboard systems
- admin systems

## Folder Structure

```text
frontend/src
├── api
│   ├── axios.ts
│   └── services.ts
├── features
│   ├── admin
│   │   ├── index.ts
│   │   ├── nginx
│   │   │   └── components
│   │   │       └── NginxConfigModal.tsx
│   │   ├── services
│   │   │   └── components
│   │   │       └── ServiceModal.tsx
│   │   └── users
│   │       └── components
│   │           └── UserManager.tsx
│   ├── dashboard
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── components
│   │       ├── DashboardNavbar.tsx
│   │       ├── DashboardSidebar.tsx
│   │       └── MobileCategoryTabs.tsx
│   └── indicators
│       ├── index.ts
│       ├── config
│       │   └── serviceCategories.ts
│       ├── lib
│       │   └── serviceHelpers.ts
│       ├── types
│       │   └── indicatorService.ts
│       └── components
│           ├── IndicatorCard.tsx
│           ├── IndicatorModuleSection.tsx
│           └── IndicatorsEmptyState.tsx
├── pages
│   ├── DashboardPage.tsx
│   ├── LoginPage.tsx
│   └── NotFoundPage.tsx
├── routes
│   └── PrivateRoute.tsx
├── utils
│   ├── auth.ts
│   └── redirect.ts
├── App.tsx
├── index.css
└── main.tsx
```

## Architectural Pattern

The frontend follows a domain-oriented structure.

- `pages` contains route-level screens
- `features` contains bounded systems grouped by business responsibility
- `api` contains HTTP integration with backend endpoints
- `routes` contains route guards
- `utils` contains shared frontend-only helpers

This means the route component should coordinate systems, but the systems themselves live in `features`.

## Pages

### `DashboardPage`

The dashboard page is the composition layer for the main authenticated experience.

Responsibilities:

- load and normalize indicators
- coordinate search state
- control active module scrolling
- open and close admin systems
- pass behavior into dashboard and indicators components

`DashboardPage` should not contain large visual blocks for cards, modules, sidebar, or topbar unless the composition itself requires it.

### `LoginPage`

The login page is its own route-level screen.

Responsibilities:

- collect credentials
- call login API
- handle redirect-after-login behavior
- handle destination awareness through `next`

### `NotFoundPage`

The 404 page is isolated as a route-level screen and should stay independent from dashboard internals.

## User-Facing Systems

### `features/dashboard`

This feature contains usability and shell components that support navigation inside the dashboard.

Components:

- `DashboardNavbar`
  - top search bar
  - user menu
  - admin actions entry point inside user dropdown
- `DashboardSidebar`
  - desktop module navigation
  - logo area
  - active category feedback
- `MobileCategoryTabs`
  - mobile navigation between modules

This feature should not know how indicators are rendered internally. It only knows about module summaries and navigation state.

### `features/indicators`

This feature contains the actual user-facing indicators system.

Subareas:

- `config/serviceCategories.ts`
  - source of truth for available categories
- `types/indicatorService.ts`
  - indicator data shape
- `lib/serviceHelpers.ts`
  - normalization and default indicator helpers
- `components`
  - `IndicatorCard`
  - `IndicatorModuleSection`
  - `IndicatorsEmptyState`

Responsibilities:

- represent modules and cards
- render indicators by category
- keep visual rules for indicator presentation

This feature should not contain navbar, sidebar, auth logic, or admin orchestration.

## Admin Systems

Admin functionality is intentionally separated because each part behaves like a subsystem with its own workflow.

### `features/admin/services`

Contains service administration UI.

- `ServiceModal`
  - add indicator
  - edit indicator
  - remove indicator
  - edit service-specific nginx blocks

### `features/admin/nginx`

Contains nginx publishing and restore workflow.

- `NginxConfigModal`
  - inspect generated config
  - copy/download config
  - publish config
  - restore previous config

### `features/admin/users`

Contains user administration workflow.

- `UserManager`
  - list users
  - create users
  - edit users
  - manage service access
  - delete users

These systems are triggered from the dashboard shell, but they should remain isolated from the user-facing module rendering logic.

## Data Flow

### Auth and route flow

- `main.tsx` boots the app
- `App.tsx` defines routes
- `PrivateRoute.tsx` protects authenticated routes
- `LoginPage.tsx` authenticates and redirects

### Dashboard flow

- `DashboardPage.tsx` fetches indicators from backend
- data is normalized through `features/indicators/lib/serviceHelpers.ts`
- categories come from `features/indicators/config/serviceCategories.ts`
- grouped data is passed to dashboard navigation and indicators modules

### Admin flow

- admin actions start in `DashboardNavbar`
- page-level state opens the appropriate admin subsystem
- each admin subsystem owns its own internal interaction flow

## Visual Design Structure

The frontend currently uses a shared visual language.

Core visual traits:

- teal brand color around `#2e7675`
- soft neutral background for app surfaces
- white cards for content and actions
- rounded corners with high radius
- compact shadows rather than heavy glass/transparency
- sticky shell elements for navigation

### Shell design

- sidebar is desktop-only and acts as module navigation
- topbar is sticky and becomes more compact on scroll
- mobile uses category tabs instead of sidebar

### Indicators design

- modules are rendered as vertical sections
- each module contains a title, count, and grid of cards
- cards show image, name, description, and target address

### Admin design

- admin systems use modal overlays
- each admin subsystem keeps its own internal layout and actions

## Asset Naming Convention

Public logo assets now follow explicit names.

- `logo-colored.webp`
  - colored symbol-only logo
  - previous name: `s-i2.webp`
- `logo-white.webp`
  - pure white symbol-only logo
  - previous name: `s-i.webp`
- `logo-white-with-name.webp`
  - pure white logo with company name on the side
  - previous name: `s-b.webp`

Usage rules:

- use `logo-white.webp` on dark backgrounds
- use `logo-colored.webp` on light backgrounds when only the symbol is needed
- use `logo-white-with-name.webp` when the full brand signature is needed on dark surfaces

## Maintenance Rules

When adding new frontend work:

- route-level concerns belong in `pages`
- navigation and shell concerns belong in `features/dashboard`
- indicator rendering and category logic belong in `features/indicators`
- admin workflows belong in the appropriate `features/admin/*` subsystem
- shared backend access stays in `api` unless a feature-specific API layer becomes necessary

Avoid reintroducing large all-in-one page files when a component clearly belongs to one of these domains.
