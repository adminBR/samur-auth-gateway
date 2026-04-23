# Frontend Reference

## Purpose

This frontend is the operator-facing portal for the auth gateway.

It does three main jobs:

1. Lets users log in and keep a browser session alive.
2. Shows the list of internal services the current user may open.
3. Gives admins UI tools for user management, service management, and NGINX config publishing.

It also includes an admin-only access analytics page for hourly auth-gateway log visualization.

Primary source files:

- `frontend/src/App.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/AuthAnalyticsPage.tsx`
- `frontend/src/api/axios.ts`
- `frontend/src/api/services.ts`
- `frontend/src/api/analytics.ts`

## Runtime Entry Points

- app bootstrap: `frontend/src/main.tsx`
- route map: `frontend/src/App.tsx`
- route guard: `frontend/src/routes/PrivateRoute.tsx`
- auth helpers: `frontend/src/utils/auth.ts`
- post-login redirect helpers: `frontend/src/utils/redirect.ts`
- static SPA NGINX config: `frontend/default.conf`
- build/dev scripts: `frontend/package.json`

## Route Map

| Route | Purpose | Source files |
| --- | --- | --- |
| `/login` | Login page with optional `next` redirect target. | `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/utils/redirect.ts` |
| `/` | Main authenticated dashboard. Protected by `PrivateRoute`. | `frontend/src/App.tsx`, `frontend/src/routes/PrivateRoute.tsx`, `frontend/src/pages/DashboardPage.tsx` |
| `/users` | Admin-only full-page user management screen. Protected by `PrivateRoute`, then redirected back to `/` if the current user is not admin. | `frontend/src/App.tsx`, `frontend/src/routes/PrivateRoute.tsx`, `frontend/src/pages/UserManagementPage.tsx`, `frontend/src/features/admin/users/components/UserManager.tsx` |
| `/auth-analytics` | Admin-only access analytics page with hourly global and per-service charts. Protected by `PrivateRoute`, then redirected back to `/` if the current user is not admin. | `frontend/src/App.tsx`, `frontend/src/routes/PrivateRoute.tsx`, `frontend/src/pages/AuthAnalyticsPage.tsx` |
| `*` | Fallback 404 page. | `frontend/src/App.tsx`, `frontend/src/pages/NotFoundPage.tsx` |

## Auth and Session Flow

### Session model

The frontend now uses a mixed header-plus-cookie session model.

Current behavior:

- access token is stored in `localStorage` under `access_token`
- refresh token is intended to live in an HttpOnly cookie managed by the backend
- `isAdmin` is stored in `localStorage` for UI bootstrapping
- `withCredentials: true` is enabled for both Axios clients so cookies travel with requests

Source of truth:

- `frontend/src/api/axios.ts`
- `frontend/src/utils/auth.ts`

### Login flow

1. `LoginPage` reads `next` from the query string and sanitizes it.
2. On submit, it waits `1000ms` before calling the backend login endpoint.
3. `loginUser()` calls `POST /api_gateway/v1/users/login/`.
4. On success, the frontend stores the returned access token and `isAdmin`, then redirects to `next` or `/`.

Source files:

- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/api/axios.ts`
- `frontend/src/utils/redirect.ts`

### Protected route flow

`PrivateRoute` blocks `/` until `isAuthenticated()` resolves.

`isAuthenticated()` calls backend token validation, and the route redirects to `/login?next=<current path>` if validation fails.

Source files:

- `frontend/src/routes/PrivateRoute.tsx`
- `frontend/src/utils/auth.ts`
- `frontend/src/api/axios.ts`
- `frontend/src/utils/redirect.ts`

### Refresh flow

The Axios response interceptor retries once on `401`.

Flow:

1. failing request gets `401`
2. `refreshAccessToken()` calls `POST /api_gateway/v1/users/refresh/`
3. if refresh succeeds, the new access token is stored in `localStorage`
4. the original request is replayed
5. if refresh fails, stored auth is cleared and the browser is redirected to login

Source files:

- `frontend/src/api/axios.ts`

### Cookie-only calls

Some frontend requests intentionally skip the `Authorization` header and rely on cookies:

- `validateToken()`
- `logoutUser()`
- `getMe()`

This is important because the backend `/me` and `/validate` endpoints are intended to work from cookies.

Source files:

- `frontend/src/api/axios.ts`

## Frontend Folder Structure

```text
frontend/src
|-- api
|   |-- axios.ts
|   |-- analytics.ts
|   `-- services.ts
|-- features
|   |-- admin
|   |   |-- index.ts
|   |   |-- nginx/components/NginxConfigModal.tsx
|   |   |-- services/components/ServiceModal.tsx
|   |   `-- users/components/UserManager.tsx
|   |-- dashboard
|   |   |-- index.ts
|   |   |-- types.ts
|   |   `-- components
|   |-- indicators
|   |   |-- index.ts
|   |   |-- config/serviceCategories.ts
|   |   |-- lib/serviceHelpers.ts
|   |   |-- types/indicatorService.ts
|   |   `-- components
|-- pages
|   |-- AuthAnalyticsPage.tsx
|   |-- DashboardPage.tsx
|   |-- LoginPage.tsx
|   |-- NotFoundPage.tsx
|   `-- UserManagementPage.tsx
|-- routes/PrivateRoute.tsx
|-- utils
|   |-- auth.ts
|   `-- redirect.ts
|-- App.tsx
|-- index.css
`-- main.tsx
```

## Main Page Responsibilities

### Login page

`frontend/src/pages/LoginPage.tsx`

Responsibilities:

- render username/password form
- display login and connectivity errors
- honor the `next` query parameter
- perform an auth check on mount
- redirect immediately if the user is already authenticated

### Dashboard page

`frontend/src/pages/DashboardPage.tsx`

Responsibilities:

- fetch service categories and service records
- fetch `/me` to show username and admin state
- normalize service data for rendering
- manage search and category navigation
- group services by category and favorites
- open admin tools
- open selected services in a new tab

Important behaviors:

- service cards open `http://${service.srv_ip}` in a new tab
- services are grouped into a synthetic `Favoritos` section plus database-backed categories
- the dashboard can open `ServiceModal` and `NginxConfigModal`
- the admin user menu navigates to the dedicated `/users` page for user management
- the admin user menu now also links to `/auth-analytics`

### Auth analytics page

`frontend/src/pages/AuthAnalyticsPage.tsx`

Responsibilities:

- fetch `/me` and redirect non-admin users back to `/`
- default to the last 24 hours and fetch only when the range filter is applied
- render one large hourly global access bar chart
- render a simplified 3-column grid of per-service charts
- show global detail rows directly on the page when a global bar is clicked
- open a modal with service-specific hourly details when the user clicks `Ver detalhes`

### Not found page

`frontend/src/pages/NotFoundPage.tsx`

Responsibilities:

- isolated 404 route fallback

## User-Facing Feature Systems

### `features/dashboard`

Main files:

- `frontend/src/features/dashboard/components/DashboardNavbar.tsx`
- `frontend/src/features/dashboard/components/DashboardSidebar.tsx`
- `frontend/src/features/dashboard/components/MobileCategoryTabs.tsx`
- `frontend/src/features/dashboard/types.ts`

Responsibilities:

- top navigation shell
- user menu and admin entry points
- desktop sidebar category navigation
- mobile category tabs
- active section state and favorites section ID

### `features/indicators`

Main files:

- `frontend/src/features/indicators/config/serviceCategories.ts`
- `frontend/src/features/indicators/lib/serviceHelpers.ts`
- `frontend/src/features/indicators/types/indicatorService.ts`
- `frontend/src/features/indicators/components/IndicatorCard.tsx`
- `frontend/src/features/indicators/components/IndicatorModuleSection.tsx`
- `frontend/src/features/indicators/components/IndicatorsEmptyState.tsx`

Responsibilities:

- service typing and normalization
- service category labels
- card rendering
- module section rendering
- empty state rendering

## Admin Systems

### Service management

Main file:

- `frontend/src/features/admin/services/components/ServiceModal.tsx`

Capabilities:

- add service
- edit service
- delete service
- upload service image
- edit `rt_frontend_block`
- edit `rt_backend_block`
- toggle `rt_enabled`
- show both NGINX editors at all times inside the service modal
- prefill both NGINX editors with reference text using the predicted service ID on create

Important NGINX validation shown in the UI:

- frontend block should include `set $service_id <srv_id>;`
- frontend block should include `auth_request /_auth;`
- frontend block should include the expected `location <path>`
- backend block should include `set $service_id <srv_id>;`
- backend block should include `auth_request /_auth;`

Create-mode note:

- when a new service is being added, the modal requests `GET /api_gateway/v1/services/next-id/` and uses that predicted value both to prefill the frontend/backend NGINX textareas and to validate the `set $service_id ...;` lines

The modal does not generate the blocks for the admin; it validates what the admin typed.

### User management

Main files:

- `frontend/src/pages/UserManagementPage.tsx`
- `frontend/src/features/admin/users/components/UserManager.tsx`

Capabilities:

- list all users
- create users
- edit users
- delete users
- toggle admin flag
- toggle "session infinite" which maps to `jwt_expiration = "inf"`
- assign service access IDs through checkbox selection
- search by username
- filter by user origin (`local` or `Tasy`)
- filter by specific access or show users without any indicator
- sort by username, admin flag, Tasy flag, access count, session type, and creation date

Behavior notes:

- runs as a dedicated full page rather than a dashboard modal
- calls backend admin endpoints in `frontend/src/api/axios.ts`
- validates admin access with `/me` and redirects non-admin users back to `/`
- displays `jwt_expiration === "inf"` as `Infinito`
- the page header now floats directly on the background with only the main title and the back action
- the top controls are rendered as a single compact inline bar with filters on the left and the summary/primary action on the right on wide screens
- the top bar uses border-only styling with no card shadow, and keeps the `Usuarios` counter and `Novo usuario` action side by side
- the built-in admin user with `id = 1` is protected in the UI and cannot be edited or removed from the management table

### NGINX operations

Main file:

- `frontend/src/features/admin/nginx/components/NginxConfigModal.tsx`

Capabilities:

- view generated config
- copy config to clipboard
- download config as `nginx.conf`
- publish config
- restore last successful config
- show deployment output and warnings returned by the backend

### Access analytics

Main files:

- `frontend/src/pages/AuthAnalyticsPage.tsx`
- `frontend/src/api/analytics.ts`

Capabilities:

- view hourly global access totals
- view hourly per-service access totals
- filter by explicit time range using `datetime-local` inputs
- use preset ranges for 24 hours, 72 hours, and 7 days
- inspect global hourly user rows inline
- inspect per-service hourly user rows in a modal

Behavior notes:

- the page uses custom responsive SVG bar charts rather than a modal-based admin tool
- service cards are intentionally simplified to a 3-column grid with one compact chart each
- the service modal opens with the latest hour that contains data selected by default

## API Dependency Map

### Auth and user endpoints

| Frontend function | Backend endpoint | Purpose | Source files |
| --- | --- | --- | --- |
| `loginUser()` | `POST /api_gateway/v1/users/login/` | login | `frontend/src/api/axios.ts`, `frontend/src/pages/LoginPage.tsx` |
| `validateToken()` | `GET /api_gateway/v1/users/validate` | auth check for route guard and startup | `frontend/src/api/axios.ts`, `frontend/src/utils/auth.ts`, `frontend/src/routes/PrivateRoute.tsx` |
| `logoutUser()` | `GET /api_gateway/v1/users/logout` | logout and cookie clear | `frontend/src/api/axios.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `getMe()` | `GET /api_gateway/v1/users/me/` | fetch username and admin state | `frontend/src/api/axios.ts`, `frontend/src/pages/DashboardPage.tsx` |
| internal refresh helper | `POST /api_gateway/v1/users/refresh/` | refresh access token after `401` | `frontend/src/api/axios.ts` |
| `getAllUsersAdmin()` | `GET /api_gateway/v1/users/admin/` | list users | `frontend/src/api/axios.ts`, `frontend/src/features/admin/users/components/UserManager.tsx` |
| `createUserAdmin()` | `POST /api_gateway/v1/users/admin/` | create user | `frontend/src/api/axios.ts`, `frontend/src/features/admin/users/components/UserManager.tsx` |
| `getUserDetailsAdmin()` | `GET /api_gateway/v1/users/admin/<id>/` | fetch single user | `frontend/src/api/axios.ts` |
| `updateUserAdmin()` | `PUT /api_gateway/v1/users/admin/<id>/` | update user | `frontend/src/api/axios.ts`, `frontend/src/features/admin/users/components/UserManager.tsx` |
| `deleteUserAdmin()` | `DELETE /api_gateway/v1/users/admin/<id>/` | delete user | `frontend/src/api/axios.ts`, `frontend/src/features/admin/users/components/UserManager.tsx` |
| `getAllServicesForAdmin()` | `GET /api_gateway/v1/users/admin/services/all/` | fetch service checklist for user manager | `frontend/src/api/axios.ts`, `frontend/src/features/admin/users/components/UserManager.tsx` |
| `getAuthAnalytics()` | `GET /api_gateway/v1/analytics/auth-access/` | fetch hourly global and per-service access analytics for the selected time range | `frontend/src/api/analytics.ts`, `frontend/src/pages/AuthAnalyticsPage.tsx` |

### Service and NGINX endpoints

| Frontend function | Backend endpoint | Purpose | Source files |
| --- | --- | --- | --- |
| `getServices()` | `GET /api_gateway/v1/services/` | list user-visible services | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `getServiceCategories()` | `GET /api_gateway/v1/services/categories/` | list categories | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `getNextServiceId()` | `GET /api_gateway/v1/services/next-id/` | fetch highest current service ID plus one for create-mode NGINX guidance | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `addService()` | `POST /api_gateway/v1/services/` | create service | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `updateService()` | `PUT /api_gateway/v1/services/<id>` | update service | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `deleteService()` | `DELETE /api_gateway/v1/services/<id>` | delete service | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `addServiceFavorite()` | `POST /api_gateway/v1/services/<id>/favorite` | add favorite | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `removeServiceFavorite()` | `DELETE /api_gateway/v1/services/<id>/favorite` | remove favorite | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `getNginxConfig()` | `GET /api_gateway/v1/nginx/config/` | preview generated config | `frontend/src/api/services.ts`, `frontend/src/pages/DashboardPage.tsx` |
| `deployNginxConfig()` | `POST /api_gateway/v1/nginx/deploy/` | publish config | `frontend/src/api/services.ts`, `frontend/src/features/admin/nginx/components/NginxConfigModal.tsx` |
| `restoreNginxConfig()` | `POST /api_gateway/v1/nginx/restore/` | restore last successful config | `frontend/src/api/services.ts`, `frontend/src/features/admin/nginx/components/NginxConfigModal.tsx` |

## UI Timings and Motion Logic

- login submit delay: `1000ms` in `frontend/src/pages/LoginPage.tsx`
- NGINX copy confirmation reset: `2000ms` in `frontend/src/features/admin/nginx/components/NginxConfigModal.tsx`
- dashboard card scroll target offset: `108px` in `frontend/src/pages/DashboardPage.tsx`
- active section detection offset: current scroll plus `200px` in `frontend/src/pages/DashboardPage.tsx`
- navbar condenses after scroll reaches `64px` and resets when scroll is `8px` or lower in `frontend/src/pages/DashboardPage.tsx`

## Visual Structure

The current frontend visual language is centered around:

- teal brand color near `#2e7675`
- pale green-gray background surfaces
- rounded white cards and modals
- sticky shell navigation
- soft gradients and grid textures

Primary implementation files:

- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/index.css`

## Public Assets and Runtime Files

- `frontend/public/logo-colored.webp`
  - light-surface symbol logo
- `frontend/public/logo-white.webp`
  - white symbol logo
- `frontend/public/logo-white-with-name.webp`
  - white full logo used in the login page
- `frontend/default.conf`
  - static NGINX config for serving the SPA with `try_files $uri /index.html`
- `frontend/package.json`
  - Vite scripts: `dev`, `build`, `lint`, `preview`

## Where To Edit Specific Behavior

- change route map: `frontend/src/App.tsx`
- change login screen behavior or copy: `frontend/src/pages/LoginPage.tsx`
- change dashboard composition, service loading, favorites, or admin modal wiring: `frontend/src/pages/DashboardPage.tsx`
- change the access analytics page layout, chart rendering, or service detail modal: `frontend/src/pages/AuthAnalyticsPage.tsx`
- change route guard behavior: `frontend/src/routes/PrivateRoute.tsx`
- change auth check helper: `frontend/src/utils/auth.ts`
- change login redirect and `next` sanitization: `frontend/src/utils/redirect.ts`
- change Axios auth, refresh, and redirect behavior: `frontend/src/api/axios.ts`
- change analytics backend calls: `frontend/src/api/analytics.ts`
- change service and NGINX backend calls: `frontend/src/api/services.ts`
- change dashboard shell and admin dropdown: `frontend/src/features/dashboard/components/DashboardNavbar.tsx`
- change sidebar navigation: `frontend/src/features/dashboard/components/DashboardSidebar.tsx`
- change mobile category tabs: `frontend/src/features/dashboard/components/MobileCategoryTabs.tsx`
- change service typing and normalization: `frontend/src/features/indicators/types/indicatorService.ts`, `frontend/src/features/indicators/lib/serviceHelpers.ts`
- change category definitions: `frontend/src/features/indicators/config/serviceCategories.ts`
- change service card rendering: `frontend/src/features/indicators/components/IndicatorCard.tsx`
- change service module rendering: `frontend/src/features/indicators/components/IndicatorModuleSection.tsx`
- change empty state: `frontend/src/features/indicators/components/IndicatorsEmptyState.tsx`
- change service admin modal and NGINX block checks: `frontend/src/features/admin/services/components/ServiceModal.tsx`
- change user management UI: `frontend/src/features/admin/users/components/UserManager.tsx`
- change NGINX preview/deploy/restore UI: `frontend/src/features/admin/nginx/components/NginxConfigModal.tsx`

## Notes For Future Agents

- The frontend depends on backend cookies being present because `/me`, `/validate`, and refresh are designed to work from cookies.
- `localStorage.refresh_token` is no longer the active refresh mechanism; the code keeps the key constant but clears it instead of using it.
- Admin UI bootstrapping still reads `localStorage.isAdmin` before `/me` fully resolves, so UI state and backend truth can temporarily diverge during startup.
- Service links are opened as `http://` plus the stored `srv_ip`, so the service record effectively controls the target URL.
- The analytics page is a routed admin page, not a dashboard modal, and it performs a second admin check with `/me` after the private-route auth gate succeeds.
