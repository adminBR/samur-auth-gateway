# FormManager Integration API

## Purpose

This API lets the FormManager backend create independently protected pages in the
existing auth gateway. Each page is stored as its own `services_info` row and gets
its own NGINX `location` and `$service_id`, even though every page shares the
`/formmanager/` path prefix.

Examples:

- `/formmanager/form1/` -> service ID `42`
- `/formmanager/form2/` -> service ID `43`

User access is still enforced by the gateway's normal `/users/validate` request.
Granting service `42` to a user does not grant service `43`.

## Base URL And Authentication

Base path:

```text
/api_gateway/v1/integrations/formmanager/
```

Every request must use the dedicated server-side API key:

```http
Authorization: Bearer <FORMMANAGER_API_KEY>
Content-Type: application/json
```

Do not expose this key in browser code. Store it only in the FormManager backend's
secret configuration.

## Gateway Configuration

Configure these values in `backend/.env` and restart the Django backend after
changing them:

```env
FORMMANAGER_API_KEY=replace-with-a-long-random-secret
FORMMANAGER_PATH_PREFIX=/formmanager
FORMMANAGER_PUBLIC_HOST=indicadores.hospitalsamur.com.br
FORMMANAGER_PUBLIC_SCHEME=https
FORMMANAGER_UPSTREAM_ORIGIN=http://127.0.0.1:3000
```

Meaning:

| Variable | Purpose |
| --- | --- |
| `FORMMANAGER_API_KEY` | Shared secret used only for this integration. |
| `FORMMANAGER_PATH_PREFIX` | NGINX namespace owned by the integration. Default: `/formmanager`. |
| `FORMMANAGER_PUBLIC_HOST` | Gateway hostname stored in `services_info.srv_ip`, without a scheme or path. |
| `FORMMANAGER_PUBLIC_SCHEME` | Scheme returned in API `public_url` values. `http` or `https`. |
| `FORMMANAGER_UPSTREAM_ORIGIN` | FormManager server origin used by `proxy_pass`. It must not contain a path, query, or credentials. |

The existing NGINX SSH variables must also be configured for publishing:

```env
NGINX_SSH_HOST=192.168.1.49
NGINX_SSH_PORT=22
NGINX_SSH_USER=deployer
NGINX_SSH_PASSWORD=replace-with-a-secure-password
NGINX_SSH_KEY_PATH=
NGINX_REMOTE_CONFIG_PATH=/etc/nginx/sites-available/api-gateway.conf
NGINX_RESTART_COMMAND=systemctl restart nginx
```

## Recommended Workflow

1. Create the page with `POST pages/` and store the returned `service_id`.
2. Grant that service ID to the required users with `PUT users/{user_id}/pages/{service_id}/`.
3. Publish NGINX with `POST nginx/publish/`.
4. Treat the operation as deployed only when the publish response has HTTP `200`
   and `success: true`.

Creating a page, changing its slug, or enabling/disabling it requires an NGINX
publish. User grants and revocations are read from PostgreSQL during every auth
check, so access-only changes take effect immediately and do not require a publish.

## Users

### List users

```http
GET /api_gateway/v1/integrations/formmanager/users/
```

Response:

```json
{
  "users": [
    { "id": 7, "name": "alice" },
    { "id": 12, "name": "bob" }
  ],
  "count": 2
}
```

Only the local user ID and login name are exposed.

## Pages

### List FormManager pages

```http
GET /api_gateway/v1/integrations/formmanager/pages/
```

Response:

```json
{
  "pages": [
    {
      "service_id": 42,
      "slug": "form1",
      "name": "Admission Form",
      "description": "Admission workflow",
      "category_id": 1,
      "enabled": true,
      "path": "/formmanager/form1/",
      "public_url": "https://indicadores.hospitalsamur.com.br/formmanager/form1/",
      "dashboard_target": "indicadores.hospitalsamur.com.br/formmanager/form1/"
    }
  ],
  "count": 1
}
```

Only services whose generated location belongs to the configured FormManager
prefix are returned.

### Create a page

```http
POST /api_gateway/v1/integrations/formmanager/pages/
```

```json
{
  "slug": "form1",
  "name": "Admission Form",
  "description": "Admission workflow",
  "category_id": 1,
  "enabled": true
}
```

Fields:

| Field | Required | Rules |
| --- | --- | --- |
| `slug` | yes | 1-100 lowercase letters, numbers, `_`, or `-`. It is placed under `/formmanager/`. |
| `name` | yes | Single line, maximum 200 characters. |
| `description` | no | Maximum 2000 characters. |
| `category_id` | no | Existing `services_category.tag_id`. Defaults to the first category. |
| `enabled` | no | JSON boolean. Defaults to `true`. |

Successful response: HTTP `201`.

```json
{
  "message": "FormManager page created.",
  "page": {
    "service_id": 42,
    "slug": "form1",
    "name": "Admission Form",
    "path": "/formmanager/form1/",
    "public_url": "https://indicadores.hospitalsamur.com.br/formmanager/form1/",
    "enabled": true
  }
}
```

The returned `service_id` is the permission identifier. Keep it in FormManager's
database alongside the form record.

### Edit a page

```http
PATCH /api_gateway/v1/integrations/formmanager/pages/42/
```

Send only fields that should change:

```json
{
  "name": "Updated Admission Form",
  "slug": "admission-form",
  "description": "Updated workflow",
  "enabled": true
}
```

The service ID remains `42`, so existing user grants remain valid if the slug is
changed. The endpoint refuses to edit a service outside the FormManager path prefix.

## User Page Access

### Grant access

```http
PUT /api_gateway/v1/integrations/formmanager/users/7/pages/42/
```

No request body is required.

```json
{
  "message": "Page access granted.",
  "changed": true,
  "user": { "id": 7, "name": "alice" },
  "service_id": 42,
  "has_access": true
}
```

### Revoke access

```http
DELETE /api_gateway/v1/integrations/formmanager/users/7/pages/42/
```

```json
{
  "message": "Page access revoked.",
  "changed": true,
  "user": { "id": 7, "name": "alice" },
  "service_id": 42,
  "has_access": false
}
```

Both operations are idempotent. `changed` is `false` when the requested state was
already present. They modify only the requested service ID and preserve all other
entries in `usr_info.usr_access`. Revoking also removes that page from the user's
favorites.

## Publish NGINX

```http
POST /api_gateway/v1/integrations/formmanager/nginx/publish/
```

No request body is required. This operation:

1. Generates the complete config from every enabled service in PostgreSQL.
2. Saves a pending version in `services_conf_log`.
3. Uploads it to the configured VM and preserves the current remote file.
4. Runs `nginx -t`.
5. Restarts NGINX only when validation passes.
6. Restores the previous file automatically if validation or restart fails.

Successful response: HTTP `200`.

```json
{
  "success": true,
  "message": "Configuração publicada e NGINX reiniciado.",
  "conf_id": 81,
  "status_label": "passed",
  "remote_path": "/etc/nginx/sites-available/api-gateway.conf",
  "services_count": 43,
  "deployment": {
    "deployed": true,
    "syntax_status": true,
    "restart_status": true,
    "rolled_back": false,
    "rollback_status": false
  }
}
```

On failure, the endpoint returns HTTP `400`, `success: false`, and deployment details.
If `deployment.rollback_status` is `true`, the previous remote config was restored.
The FormManager caller should use a request timeout long enough for SSH, validation,
and restart; 60 seconds is a reasonable initial value.

## Generated NGINX Behavior

For service ID `42` and slug `form1`, the integration stores a block equivalent to:

```nginx
location /formmanager/form1/ {
    set $service_id 42;

    error_page 401 = @redirect_login;
    error_page 403 = @api_err403;

    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

The server-level `auth_request /_auth` is inherited by this location. NGINX sends
`X-Service-ID: 42` to Django, and Django checks whether `42` is present in the user's
access list.

Important: `proxy_pass` contains only an origin and no URI suffix. Therefore the
upstream FormManager application receives the original path unchanged, including
`/formmanager/form1/`. The FormManager router must serve that path or rewrite it in
its own application.

## Error Contract

Common statuses:

| Status | Meaning |
| --- | --- |
| `200` | Read, edit, access mutation, or publish succeeded. |
| `201` | Page created. |
| `400` | Invalid payload, duplicate slug, missing category, or NGINX publish failed. |
| `401` | Missing or invalid integration API key. |
| `404` | User, service, or FormManager-owned page not found. |
| `503` | FormManager integration environment variables are not configured. |

Error bodies use DRF's normal `detail` field or a field-specific validation object.

## Implementation Map

- routes: `backend/integrations/urls.py`
- API-key authentication: `backend/integrations/authentication.py`
- page, user-access, and publish logic: `backend/integrations/views.py`
- shared NGINX generation/deployment: `backend/nginx/builder.py`
- SSH test/restart/rollback: `backend/infrastructure/managers.py`
- generated header source: `backend/header.local.conf`

No new database table or migration is required. FormManager ownership is constrained
by the generated location prefix, and existing service IDs remain the source of truth
for permissions.
