# Backend Auth Gateway Reference

## Purpose

This backend is the control plane for the company auth gateway.

It does four main jobs:

1. Authenticates portal users and manages their sessions.
2. Stores which internal services each user may access.
3. Generates and deploys NGINX gateway config for protected services.
4. Exposes a work-order endpoint that proxies Oracle insert requests through a DB proxy.

The main URL root is defined in `backend/serviceauth/urls.py`.

## High-Level Request Flow

1. A user opens the portal frontend served behind NGINX.
2. The frontend logs in through `POST /api_gateway/v1/users/login/`.
3. The backend creates a custom access token and refresh token, returns them in JSON, and also sets them as cookies.
4. When the user opens a protected page behind the gateway, NGINX runs an internal subrequest to `GET /api_gateway/v1/users/validate` and forwards the browser cookies plus `X-Service-ID`.
5. The backend validates the access token and checks whether the user has that service ID in `usr_info.usr_access`.
6. If validation passes, NGINX proxies the request to the target page or API. If it fails, NGINX redirects the browser to `/login?next=...` or returns JSON errors depending on the location block.

Source of truth for the gateway flow:

- `backend/users/views.py`
- `backend/utils/jwt.py`
- `backend/nginx/reference.py`
- `extra/api-gateway.conf`
- `extra/example.conf`

## Backend Ownership Map

- `backend/serviceauth/urls.py`
  - top-level route registration
- `backend/serviceauth/settings.py`
  - auth, cookie, CORS, CSRF, logging, DRF config
- `backend/users/views.py`
  - login, logout, validate, refresh, `/me`, admin user endpoints
- `backend/users/auth.py`
  - DRF authentication class for access token auth
- `backend/utils/jwt.py`
  - custom token creation, validation, cookie helpers, admin auth helper
- `backend/utils/database.py`
  - real PostgreSQL connection used by the app code
- `backend/services/views.py`
  - service listing, categories, favorites, create/update/delete service
- `backend/nginx/builder.py`
  - generate, deploy, and restore NGINX config
- `backend/nginx/nginx_builder.py`
  - injects generated service blocks into the header template
- `backend/nginx/reference.py`
  - loads the machine-local or example header template
- `backend/infrastructure/managers.py`
  - SSH connection and remote `nginx -t` execution
- `backend/workorders/views.py`
  - work-order endpoint
- `backend/workorders/services.py`
  - DB proxy HTTP call for work orders
- `backend/workorders/serializers.py`
  - work-order request schema
- `backend/users/tests.py`
  - auth regression tests for refresh, `/me`, and cookie auth

## Real Runtime Configuration

### Env loading

The backend reads `backend/.env` through `backend/utils/env.py`.

Important implication:

- `backend/serviceauth/settings.py` contains a default Django `DATABASES` SQLite config.
- The actual app endpoints do not use that database for business data.
- The real operational database connection comes from `backend/utils/database.py`, which opens PostgreSQL connections directly with `psycopg2`.

### Main env-backed auth and cookie settings

Defined in `backend/serviceauth/settings.py`:

- `AUTH_TOKEN_ALGORITHM`
- `AUTH_ACCESS_TOKEN_DEFAULT_DAYS`
- `AUTH_REFRESH_TOKEN_DAYS`
- `AUTH_ACCESS_TOKEN_COOKIE_NAME`
- `AUTH_REFRESH_TOKEN_COOKIE_NAME`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_COOKIE_PATH`
- `AUTH_COOKIE_SAMESITE`
- `AUTH_COOKIE_SECURE`
- `AUTH_COOKIE_HTTPONLY`
- `AUTH_INFINITE_TOKEN_COOKIE_MAX_AGE_SECONDS`

### Main env-backed database settings

Defined in `backend/utils/database.py`:

- `DJANGO_DB_HOST`
- `DJANGO_DB_PORT`
- `DJANGO_DB_NAME`
- `DJANGO_DB_USER`
- `DJANGO_DB_PASSWORD`
- `DJANGO_DB_CONNECT_TIMEOUT`

## Auth and Session Model

### Token implementation

The portal uses a custom JWT implementation in `backend/utils/jwt.py`, not the SimpleJWT pair flow used by the main app endpoints.

Custom token payload fields:

- `user_id`
- `user_name`
- `token_type`
- `issued_at`
- `expiration`
- `exp` for non-infinite tokens

Token types:

- access: `TOKEN_TYPE_ACCESS`
- refresh: `TOKEN_TYPE_REFRESH`

### Access token lifetime

Access token lifetime is resolved in this order:

1. User-specific `usr_info.jwt_expiration`
2. Fallback `AUTH_ACCESS_TOKEN_DEFAULT_DAYS`

Accepted values:

- positive integer day count such as `1`
- `inf`

Code path:

- `backend/users/views.py`
- `backend/utils/jwt.py`

### Refresh token lifetime

Refresh token lifetime is controlled by `AUTH_REFRESH_TOKEN_DAYS` and defaults to `90` days.

Code path:

- `backend/serviceauth/settings.py`
- `backend/utils/jwt.py`

### Cookie behavior

Access and refresh tokens are both written as cookies from the backend.

Cookie handling lives in `backend/utils/jwt.py`.

Important behavior:

- login sets both access and refresh cookies
- refresh rewrites the access cookie and refresh cookie
- logout clears both cookies
- `/me` prefers the access token from the cookie
- `/validate` prefers the access token from the cookie
- DRF authenticated endpoints use `JWTCustomAuth`, which checks `Authorization` first and then falls back to the access-token cookie
- admin helper `get_admin_user_from_token()` also uses header-first behavior

Cookie names are configurable:

- access cookie default: `token`
- refresh cookie default: `refresh_token`

## Operational Timings and Timeouts

- access token default lifetime: `AUTH_ACCESS_TOKEN_DEFAULT_DAYS` in `backend/serviceauth/settings.py`
- per-user access token lifetime override: `usr_info.jwt_expiration` used in `backend/users/views.py`
- refresh token lifetime: `AUTH_REFRESH_TOKEN_DAYS`, default `90` days, in `backend/serviceauth/settings.py`
- infinite-token cookie max-age: `AUTH_INFINITE_TOKEN_COOKIE_MAX_AGE_SECONDS`, default `20` years, in `backend/serviceauth/settings.py`
- PostgreSQL connection timeout: `5` seconds default in `backend/utils/database.py`
- SSH connect timeout: `15` seconds in `backend/infrastructure/managers.py`
- DB proxy request timeout for work orders: `30` seconds in `backend/workorders/services.py`
- NGINX proxy timeouts in the example header template: `proxy_connect_timeout 300s`, `proxy_send_timeout 300s`, `proxy_read_timeout 300s`, `send_timeout 300s` in `backend/nginx/header.example.conf`
- work-order desired completion date offset: `+2` days in `backend/workorders/views.py`

## Endpoint Catalog

### Users and Auth

| Method | Path | Auth | What it does | Source files |
| --- | --- | --- | --- | --- |
| `POST` | `/api_gateway/v1/users/login/` | public | Validates credentials, returns `access_token`, `refresh_token`, `isAdmin`, `jwt_expiration`, and sets both cookies. | `backend/users/urls.py`, `backend/users/views.py`, `backend/utils/jwt.py` |
| `GET` | `/api_gateway/v1/users/me/` | access token | Returns `user_id`, `user_name`, `is_admin`. Prefers cookie auth. | `backend/users/urls.py`, `backend/users/views.py`, `backend/utils/jwt.py` |
| `GET` | `/api_gateway/v1/users/logout` | optional | Clears auth cookies and returns `Logged out`. | `backend/users/urls.py`, `backend/users/views.py`, `backend/utils/jwt.py` |
| `GET` | `/api_gateway/v1/users/validate` | access token | Validates the access token. If `X-Service-ID` is present, also checks `usr_info.usr_access`. Returns `401` when the user is unauthenticated and `403` when the token is valid but the user lacks access to that service. Used by NGINX `auth_request`. | `backend/users/urls.py`, `backend/users/views.py`, `backend/utils/jwt.py`, `extra/example.conf` |
| `POST` | `/api_gateway/v1/users/refresh/` | refresh token | Accepts a refresh token from request body or refresh cookie, validates it, issues a new access token, and rewrites auth cookies. | `backend/users/urls.py`, `backend/users/views.py`, `backend/utils/jwt.py` |
| `GET` | `/api_gateway/v1/users/admin/` | admin | Lists all users with `id`, `username`, `is_admin`, `access`, `created_at`, `jwt_expiration`. | `backend/users/urls.py`, `backend/users/views.py` |
| `POST` | `/api_gateway/v1/users/admin/` | admin | Creates a user. Accepts `user_name`, `user_pass`, `is_admin`, `access`, `jwt_expiration`. | `backend/users/urls.py`, `backend/users/views.py` |
| `GET` | `/api_gateway/v1/users/admin/<target_user_id>/` | admin | Returns a single user record. | `backend/users/urls.py`, `backend/users/views.py` |
| `PUT` | `/api_gateway/v1/users/admin/<target_user_id>/` | admin | Updates password, admin flag, service access list, or `jwt_expiration`. Prevents self de-admin. | `backend/users/urls.py`, `backend/users/views.py` |
| `DELETE` | `/api_gateway/v1/users/admin/<target_user_id>/` | admin | Deletes a user. Prevents self delete. | `backend/users/urls.py`, `backend/users/views.py` |
| `GET` | `/api_gateway/v1/users/admin/services/all/` | admin | Lists all services for the user-management UI. | `backend/users/urls.py`, `backend/users/views.py` |

Notes:

- `UserRegister` still exists in `backend/users/views.py`, but its route is commented out in `backend/users/urls.py`.
- Password validation requires minimum length `6` and at least one letter and one number in `backend/users/views.py`.
- The current login query matches `usr_password` directly in SQL, so the current implementation behaves like plain-text password comparison.

### Services

| Method | Path | Auth | What it does | Source files |
| --- | --- | --- | --- | --- |
| `GET` | `/api_gateway/v1/services/` | authenticated | Lists only the services present in the requesting user's `usr_access`. Includes image, name, IP, description, category, NGINX blocks, enabled flag, and favorite state. | `backend/services/urls.py`, `backend/services/views.py` |
| `GET` | `/api_gateway/v1/services/next-id/` | admin | Returns the predicted next service ID as `MAX(srv_id) + 1` for the frontend service editor reference snippets and validation. | `backend/services/urls.py`, `backend/services/views.py` |
| `POST` | `/api_gateway/v1/services/` | admin | Creates a service in `services_info`, stores image bytes, category, frontend/backend NGINX blocks, and enabled state. Also appends the new service ID to the creating admin's `usr_access`. | `backend/services/urls.py`, `backend/services/views.py` |
| `GET` | `/api_gateway/v1/services/categories/` | authenticated | Lists `services_category` records. | `backend/services/urls.py`, `backend/services/views.py` |
| `POST` | `/api_gateway/v1/services/<service_id>/favorite` | authenticated | Marks a service as favorite for the current user if the user has access to it. | `backend/services/urls.py`, `backend/services/views.py` |
| `DELETE` | `/api_gateway/v1/services/<service_id>/favorite` | authenticated | Removes a favorite relation for the current user. | `backend/services/urls.py`, `backend/services/views.py` |
| `PUT` | `/api_gateway/v1/services/<service_id>` | admin | Updates service fields, image, category, NGINX blocks, and enabled state. | `backend/services/urls.py`, `backend/services/views.py` |
| `DELETE` | `/api_gateway/v1/services/<service_id>` | admin | Deletes a service from `services_info`. | `backend/services/urls.py`, `backend/services/views.py` |

Important service fields:

- `srv_id`
- `srv_image`
- `srv_name`
- `srv_ip`
- `srv_desc`
- `srv_category`
- `rt_frontend_block`
- `rt_backend_block`
- `rt_enabled`

### NGINX

| Method | Path | Auth | What it does | Source files |
| --- | --- | --- | --- | --- |
| `GET` | `/api_gateway/v1/nginx/config/` | admin | Reads service blocks from the database, merges them into the header template, and returns the generated config text. Optional query param: `header` for override. | `backend/nginx/urls.py`, `backend/nginx/builder.py`, `backend/nginx/nginx_builder.py`, `backend/nginx/reference.py` |
| `POST` | `/api_gateway/v1/nginx/deploy/` | admin | Inserts a pending record into `services_conf_log`, pushes the config over SSH, runs `nginx -t`, and updates the log status. | `backend/nginx/urls.py`, `backend/nginx/builder.py`, `backend/infrastructure/managers.py` |
| `POST` | `/api_gateway/v1/nginx/restore/` | admin | Restores the latest successful config from `services_conf_log` and redeploys it over SSH. | `backend/nginx/urls.py`, `backend/nginx/builder.py`, `backend/infrastructure/managers.py` |

Current deployment implementation details:

- remote config path: `/etc/nginx/sites-available/api-gateway.conf`
- SSH connection code: `backend/infrastructure/managers.py`
- current SSH host, port, user, and password are hardcoded in `backend/nginx/builder.py`
- the deployed file is first uploaded to `/tmp/nginx-config-<uuid>.conf`, then moved into place, chmodded to `644`, and tested with `nginx -t`

### Work Orders

| Method | Path | Auth | What it does | Source files |
| --- | --- | --- | --- | --- |
| `POST` | `/api_gateway/v1/workorders/ordens/` | authenticated | Validates the request body, builds an Oracle insert statement, and sends it to the DB proxy. | `backend/workorders/urls.py`, `backend/workorders/views.py`, `backend/workorders/serializers.py`, `backend/workorders/services.py` |

Required work-order payload fields:

- `ClassSel`
- `ParadSel`
- `PrioSel`
- `dsdano`
- `dsDescrib`
- `dsLocalizacao`
- `dsEquipamento`

Behavior notes:

- current username is read from `request.user.username`
- desired completion date is set to current time plus 2 days
- DB proxy URL and passkey are currently hardcoded in `backend/workorders/services.py`

### SimpleJWT Utility Endpoints

These are exposed from `backend/serviceauth/urls.py`:

- `POST /api_gateway/token/`
- `POST /api_gateway/token/refresh/`

They exist because `rest_framework_simplejwt` is registered, but the portal login flow is currently built on the custom JWT code in `backend/users/views.py` and `backend/utils/jwt.py`.

## NGINX Config Generation Model

The generated config is assembled from two pieces:

1. Header template loaded from `backend/nginx/header.local.conf`
2. Per-service frontend and backend blocks stored in `services_info`

Fallback behavior:

- if `backend/nginx/header.local.conf` does not exist, the backend falls back to `backend/nginx/header.example.conf`

Generation logic:

- the header template should contain `{{SYSTEM_GENERATED_PATHS}}`
- `backend/nginx/reference.py` loads the header text from file
- `backend/nginx/builder.py` loads service records ordered by `srv_id`
- `backend/nginx/nginx_builder.py` replaces the placeholder with the generated per-service blocks
- frontend block is emitted first
- backend block is emitted immediately after that service's frontend block

Service authorship model:

- a service record stores its own NGINX frontend block
- the same service record stores its own NGINX backend/API block
- the service ID is expected to match the `set $service_id ...;` lines used by `auth_request`
- the admin frontend now fetches `/api_gateway/v1/services/next-id/` while creating a new service so it can validate against a predicted `set $service_id ...;` line before the row exists

Reference examples:

- `backend/nginx/header.example.conf`
- `backend/nginx/reference.py`
- `extra/api-gateway.conf`
- `extra/example.conf`

## Data Model Assumptions Used by the Code

The backend code expects at least these tables:

- `usr_info`
- `services_info`
- `services_category`
- `usr_favorite_services`
- `services_conf_log`

Observed columns used directly in code include:

- `usr_info.usr_id`
- `usr_info.usr_login`
- `usr_info.usr_password`
- `usr_info.usr_access`
- `usr_info.usr_admin`
- `usr_info.created_at`
- `usr_info.jwt_expiration`
- `services_info.srv_id`
- `services_info.srv_image`
- `services_info.srv_name`
- `services_info.srv_ip`
- `services_info.srv_desc`
- `services_info.srv_category`
- `services_info.rt_frontend_block`
- `services_info.rt_backend_block`
- `services_info.rt_enabled`
- `services_category.tag_id`
- `services_category.tag_name`
- `usr_favorite_services.usr_id`
- `usr_favorite_services.srv_id`
- `services_conf_log.conf_id`
- `services_conf_log.conf_text`
- `services_conf_log.conf_status`

## Where To Edit Specific Behavior

- change top-level route registration: `backend/serviceauth/urls.py`
- change auth and cookie defaults: `backend/serviceauth/settings.py`
- change token creation or cookie write/clear logic: `backend/utils/jwt.py`
- change DRF auth fallback behavior: `backend/users/auth.py`
- change login, refresh, validate, `/me`, or admin user logic: `backend/users/views.py`
- change service listing or service CRUD rules: `backend/services/views.py`
- change category parsing or favorites behavior: `backend/services/views.py`
- change NGINX header template loading: `backend/nginx/reference.py`
- change the tracked example template: `backend/nginx/header.example.conf`
- change the machine-local template on one machine: `backend/nginx/header.local.conf`
- change config concatenation rules: `backend/nginx/nginx_builder.py`
- change deploy/restore flow: `backend/nginx/builder.py`
- change SSH execution details: `backend/infrastructure/managers.py`
- change work-order request schema: `backend/workorders/serializers.py`
- change work-order SQL generation: `backend/workorders/views.py`
- change DB proxy target or timeout: `backend/workorders/services.py`
- change PostgreSQL connection env names/defaults: `backend/utils/database.py`
- change auth regression coverage: `backend/users/tests.py`

## Known Implementation Notes For Future Agents

- The backend business data is not using Django ORM models for the core flows; most reads and writes are raw SQL through `psycopg2`.
- Cookie auth is now part of the intended runtime behavior, especially for `/me`, `/validate`, and refresh.
- The app exposes SimpleJWT endpoints, but the portal uses the custom JWT flow instead.
- Service access control is string-based and depends on comma-separated service IDs in `usr_info.usr_access`.
- Several infrastructure values are still hardcoded in source files rather than moved to env:
  - SSH deployment settings in `backend/nginx/builder.py`
  - work-order DB proxy settings in `backend/workorders/services.py`
