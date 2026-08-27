# Admin API for External Systems

This is the handoff contract for an external system that needs to manage gateway
services and user access. The external system owns its domain, page names, URL
hierarchy, and NGINX route blocks. This backend only stores generic services,
assigns access by service ID, and publishes the gateway configuration.

## Base URL and authentication

Examples use this base URL:

```text
https://your-auth-gateway.example.com/api_gateway/v1
```

Log in with an existing portal administrator:

```http
POST /users/login/
Content-Type: application/json

{
  "user_name": "admin",
  "user_pass": "admin-password"
}
```

The response contains `access_token`, `refresh_token`, and `isAdmin`. Reject the
login result unless `isAdmin` is `true`. Send the access token on every operation
below:

```http
Authorization: Bearer <access_token>
```

Refresh an expired access token with `POST /users/refresh/` and body
`{"refresh_token":"<refresh_token>"}`.

## Users and access

Fetch user names, IDs, and current access:

```http
GET /users/admin/
Authorization: Bearer <access_token>
```

The response is an array. Relevant fields are `id`, `username`, and `access`.

Grant one service without replacing other access:

```http
PUT /users/admin/{user_id}/services/{service_id}/
Authorization: Bearer <access_token>
```

Revoke one service without replacing other access:

```http
DELETE /users/admin/{user_id}/services/{service_id}/
Authorization: Bearer <access_token>
```

Both operations are idempotent and return:

```json
{
  "changed": true,
  "service_id": 42,
  "has_access": true,
  "user": {
    "id": 7,
    "username": "alice",
    "access": "2,5,42"
  }
}
```

Revoking access also removes that service from the user's favorites. Permission
changes do not require an NGINX publish.

## Services

Each independently protected page must be a separate generic service row. This
backend does not reserve or interpret URL prefixes. For example,
`/external-pages/page-1/` and `/external-pages/page-2/` are simply two services
whose NGINX blocks happen to use related paths.

List categories:

```http
GET /services/categories/
Authorization: Bearer <access_token>
```

Create a service:

```http
POST /services/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

| Field | Required | Meaning |
| --- | --- | --- |
| `srv_image` | yes | JPG, JPEG, PNG, or GIF file |
| `srv_name` | yes | Display name |
| `srv_ip` | yes | Link/host displayed by the portal |
| `srv_desc` | no | Description |
| `srv_category` | no | Category ID/name; defaults to the first category |
| `rt_frontend_block` | no | NGINX page/location block |
| `rt_backend_block` | no | Optional NGINX API/location block |
| `rt_enabled` | no | Defaults to `true` |

Success returns the assigned service ID:

```json
{"message":"Success","id":42}
```

When the NGINX block needs `set $service_id`, create the service with empty route
blocks, read the returned `id`, and then update the route blocks with that exact
ID. This avoids relying on `GET /services/next-id/` during concurrent writes.

Edit a service by sending only the fields to change:

```http
PUT /services/{service_id}
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Accepted fields are `srv_image`, `srv_name`, `srv_ip`, `srv_desc`, `srv_category`,
`rt_frontend_block`, `rt_backend_block`, and `rt_enabled`.

Example external-owned route block:

```nginx
location /external-pages/page-1/ {
    set $service_id 42;

    error_page 401 = @redirect_login;
    error_page 403 = @api_err403;

    proxy_pass http://external-system;
    proxy_http_version 1.1;
}
```

The external system owns this text. This backend does not generate or constrain
the path.

## Publish NGINX

After creating or editing service route blocks, publish all enabled services:

```http
POST /nginx/publish/
Authorization: Bearer <access_token>
Content-Type: application/json

{}
```

This generates the config from the database, uploads it over SSH, runs `nginx -t`,
and gracefully reloads NGINX only when validation succeeds. A failed validation
or reload uses the existing automatic rollback.

HTTP `200` indicates success:

```json
{
  "success": true,
  "status_label": "passed",
  "services_count": 12,
  "conf_id": 81,
  "remote_path": "/etc/nginx/sites-available/api-gateway.conf",
  "deployment": {
    "deployed": true,
    "test_status": true,
    "restart_status": true
  }
}
```

Deployment failure uses HTTP `400`, returns `success: false`, and includes rollback
details. Unexpected server or database failures use HTTP `500`.

## Recommended workflow

1. Log in with the portal administrator and retain the tokens securely.
2. Create the generic service and read its assigned ID.
3. Update its NGINX block with that service ID.
4. Grant the service to selected users.
5. Call `POST /nginx/publish/` once after route changes are complete.
