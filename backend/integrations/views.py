import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from nginx.builder import publish_current_nginx_config
from utils.database import get_db_connection
from utils.env import env

from .authentication import FormManagerApiKeyAuthentication

LOCATION_PATTERN = re.compile(r"location\s+([^\s{]+)\s*\{")
SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]{0,99}$")
PUBLIC_HOST_PATTERN = re.compile(r"^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$")


class FormManagerConfigurationError(APIException):
    status_code = 503
    default_code = "formmanager_not_configured"


@dataclass(frozen=True)
class FormManagerRoutingConfig:
    path_prefix: str
    public_host: str
    public_scheme: str
    upstream_origin: str


def _path_prefix() -> str:
    raw_prefix = str(env("FORMMANAGER_PATH_PREFIX", "/formmanager") or "").strip()
    normalized = f"/{raw_prefix.strip('/')}"
    if not normalized.strip("/") or not re.fullmatch(r"/[a-zA-Z0-9/_-]+", normalized):
        raise FormManagerConfigurationError("FORMMANAGER_PATH_PREFIX is invalid.")
    return normalized


def _routing_config() -> FormManagerRoutingConfig:
    public_host = str(env("FORMMANAGER_PUBLIC_HOST", "") or "").strip()
    public_scheme = str(env("FORMMANAGER_PUBLIC_SCHEME", "https") or "").strip().lower()
    upstream_origin = str(env("FORMMANAGER_UPSTREAM_ORIGIN", "") or "").strip().rstrip("/")

    if not public_host or not PUBLIC_HOST_PATTERN.fullmatch(public_host):
        raise FormManagerConfigurationError(
            "FORMMANAGER_PUBLIC_HOST must be a hostname with an optional port."
        )
    if public_scheme not in {"http", "https"}:
        raise FormManagerConfigurationError(
            "FORMMANAGER_PUBLIC_SCHEME must be http or https."
        )

    parsed_origin = urlsplit(upstream_origin)
    if (
        parsed_origin.scheme not in {"http", "https"}
        or not parsed_origin.netloc
        or parsed_origin.username
        or parsed_origin.password
        or parsed_origin.path not in {"", "/"}
        or parsed_origin.query
        or parsed_origin.fragment
    ):
        raise FormManagerConfigurationError(
            "FORMMANAGER_UPSTREAM_ORIGIN must be an HTTP(S) origin without path, query or credentials."
        )

    return FormManagerRoutingConfig(
        path_prefix=_path_prefix(),
        public_host=public_host,
        public_scheme=public_scheme,
        upstream_origin=upstream_origin,
    )


def _validate_slug(value) -> str:
    slug = str(value or "").strip()
    if not SLUG_PATTERN.fullmatch(slug):
        raise ValidationError(
            {"slug": "Use 1-100 lowercase letters, numbers, underscores or hyphens."}
        )
    return slug


def _validate_name(value) -> str:
    name = str(value or "").strip()
    if not name or len(name) > 200 or "\n" in name or "\r" in name:
        raise ValidationError({"name": "A single-line name with at most 200 characters is required."})
    return name


def _validate_description(value) -> str:
    description = str(value or "").strip()
    if len(description) > 2000:
        raise ValidationError({"description": "Use at most 2000 characters."})
    return description


def _validate_enabled(value, *, default: bool) -> bool:
    if value is None:
        return default
    if not isinstance(value, bool):
        raise ValidationError({"enabled": "Use a JSON boolean."})
    return value


def _location_path(frontend_block: str | None) -> str | None:
    match = LOCATION_PATTERN.search(frontend_block or "")
    return match.group(1) if match else None


def _managed_slug(frontend_block: str | None, path_prefix: str) -> str | None:
    location_path = _location_path(frontend_block)
    expected_start = f"{path_prefix}/"
    if not location_path or not location_path.startswith(expected_start):
        return None
    slug = location_path[len(expected_start):].strip("/")
    return slug if SLUG_PATTERN.fullmatch(slug) else None


def _page_path(path_prefix: str, slug: str) -> str:
    return f"{path_prefix}/{slug}/"


def _build_frontend_block(service_id: int, path: str, upstream_origin: str) -> str:
    return f"""location {path} {{
    set $service_id {service_id};

    error_page 401 = @redirect_login;
    error_page 403 = @api_err403;

    proxy_pass {upstream_origin};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}}"""


def _resolve_category_id(cur, value) -> int:
    if value is None:
        cur.execute("SELECT tag_id FROM services_category ORDER BY tag_id LIMIT 1")
        row = cur.fetchone()
        if not row:
            raise APIException("No service category is configured.")
        return int(row[0])

    try:
        category_id = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({"category_id": "Use an existing numeric category ID."}) from exc

    cur.execute("SELECT 1 FROM services_category WHERE tag_id = %s", (category_id,))
    if not cur.fetchone():
        raise ValidationError({"category_id": "Service category not found."})
    return category_id


def _parse_access_ids(raw_access) -> list[int]:
    result = []
    seen = set()
    for raw_id in str(raw_access or "").split(","):
        raw_id = raw_id.strip()
        if not raw_id.isdigit():
            continue
        service_id = int(raw_id)
        if service_id not in seen:
            seen.add(service_id)
            result.append(service_id)
    return result


def _serialize_page(row, config: FormManagerRoutingConfig) -> dict:
    service_id, name, srv_ip, description, category_id, frontend_block, enabled = row
    slug = _managed_slug(frontend_block, config.path_prefix)
    path = _page_path(config.path_prefix, slug) if slug else None
    return {
        "service_id": int(service_id),
        "slug": slug,
        "name": name,
        "description": description or "",
        "category_id": int(category_id),
        "enabled": bool(enabled),
        "path": path,
        "public_url": f"{config.public_scheme}://{config.public_host}{path}" if path else None,
        "dashboard_target": srv_ip,
    }


class FormManagerIntegrationView(APIView):
    authentication_classes = [FormManagerApiKeyAuthentication]
    permission_classes = [IsAuthenticated]


class FormManagerUsersView(FormManagerIntegrationView):
    def get(self, request):
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("SELECT usr_id, usr_login FROM usr_info ORDER BY usr_login, usr_id")
            users = [
                {"id": int(user_id), "name": user_name}
                for user_id, user_name in cur.fetchall()
            ]
            return Response({"users": users, "count": len(users)})
        finally:
            cur.close()
            conn.close()


class FormManagerPagesView(FormManagerIntegrationView):
    def get(self, request):
        config = _routing_config()
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                """
                SELECT srv_id, srv_name, srv_ip, srv_desc, srv_category,
                       rt_frontend_block, rt_enabled
                FROM services_info
                ORDER BY srv_id
                """
            )
            pages = [
                _serialize_page(row, config)
                for row in cur.fetchall()
                if _managed_slug(row[5], config.path_prefix)
            ]
            return Response({"pages": pages, "count": len(pages)})
        finally:
            cur.close()
            conn.close()

    def post(self, request):
        config = _routing_config()
        slug = _validate_slug(request.data.get("slug"))
        name = _validate_name(request.data.get("name"))
        description = _validate_description(request.data.get("description", ""))
        enabled = _validate_enabled(request.data.get("enabled"), default=True)
        path = _page_path(config.path_prefix, slug)

        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            cur.execute("LOCK TABLE services_info IN SHARE ROW EXCLUSIVE MODE")
            cur.execute("SELECT rt_frontend_block FROM services_info")
            if any(_location_path(row[0]) == path for row in cur.fetchall()):
                raise ValidationError({"slug": "A FormManager page already uses this slug."})

            category_id = _resolve_category_id(cur, request.data.get("category_id"))
            dashboard_target = f"{config.public_host}{path}"
            cur.execute(
                """
                INSERT INTO services_info (
                    srv_image, srv_name, srv_ip, srv_desc, srv_category,
                    rt_frontend_block, rt_backend_block, rt_enabled
                )
                VALUES (NULL, %s, %s, %s, %s, '', '', %s)
                RETURNING srv_id
                """,
                (name, dashboard_target, description, category_id, enabled),
            )
            service_id = int(cur.fetchone()[0])
            frontend_block = _build_frontend_block(
                service_id,
                path,
                config.upstream_origin,
            )
            cur.execute(
                "UPDATE services_info SET rt_frontend_block = %s WHERE srv_id = %s",
                (frontend_block, service_id),
            )
            conn.commit()
            row = (
                service_id,
                name,
                dashboard_target,
                description,
                category_id,
                frontend_block,
                enabled,
            )
            return Response(
                {"message": "FormManager page created.", "page": _serialize_page(row, config)},
                status=status.HTTP_201_CREATED,
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()


class FormManagerPageDetailView(FormManagerIntegrationView):
    def patch(self, request, service_id: int):
        config = _routing_config()
        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            cur.execute("LOCK TABLE services_info IN SHARE ROW EXCLUSIVE MODE")
            cur.execute(
                """
                SELECT srv_id, srv_name, srv_ip, srv_desc, srv_category,
                       rt_frontend_block, rt_enabled
                FROM services_info
                WHERE srv_id = %s
                FOR UPDATE
                """,
                (service_id,),
            )
            current = cur.fetchone()
            if not current:
                raise NotFound("Service not found.")
            current_slug = _managed_slug(current[5], config.path_prefix)
            if not current_slug:
                raise NotFound("FormManager page not found.")

            slug = (
                _validate_slug(request.data.get("slug"))
                if "slug" in request.data
                else current_slug
            )
            name = (
                _validate_name(request.data.get("name"))
                if "name" in request.data
                else current[1]
            )
            description = (
                _validate_description(request.data.get("description"))
                if "description" in request.data
                else current[3] or ""
            )
            category_id = (
                _resolve_category_id(cur, request.data.get("category_id"))
                if "category_id" in request.data
                else int(current[4])
            )
            enabled = (
                _validate_enabled(request.data.get("enabled"), default=bool(current[6]))
                if "enabled" in request.data
                else bool(current[6])
            )
            path = _page_path(config.path_prefix, slug)

            if slug != current_slug:
                cur.execute(
                    "SELECT srv_id, rt_frontend_block FROM services_info WHERE srv_id <> %s",
                    (service_id,),
                )
                if any(_location_path(row[1]) == path for row in cur.fetchall()):
                    raise ValidationError({"slug": "A FormManager page already uses this slug."})

            dashboard_target = f"{config.public_host}{path}"
            frontend_block = _build_frontend_block(
                service_id,
                path,
                config.upstream_origin,
            )
            cur.execute(
                """
                UPDATE services_info
                SET srv_name = %s,
                    srv_ip = %s,
                    srv_desc = %s,
                    srv_category = %s,
                    rt_frontend_block = %s,
                    rt_backend_block = '',
                    rt_enabled = %s
                WHERE srv_id = %s
                """,
                (
                    name,
                    dashboard_target,
                    description,
                    category_id,
                    frontend_block,
                    enabled,
                    service_id,
                ),
            )
            conn.commit()
            row = (
                service_id,
                name,
                dashboard_target,
                description,
                category_id,
                frontend_block,
                enabled,
            )
            return Response(
                {"message": "FormManager page updated.", "page": _serialize_page(row, config)}
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()


class FormManagerUserPageAccessView(FormManagerIntegrationView):
    def _change_access(self, user_id: int, service_id: int, *, grant: bool):
        path_prefix = _path_prefix()
        conn = get_db_connection()
        cur = conn.cursor()
        conn.autocommit = False
        try:
            cur.execute(
                "SELECT rt_frontend_block FROM services_info WHERE srv_id = %s FOR SHARE",
                (service_id,),
            )
            service_row = cur.fetchone()
            if not service_row or not _managed_slug(service_row[0], path_prefix):
                raise NotFound("FormManager page not found.")

            cur.execute(
                "SELECT usr_login, usr_access FROM usr_info WHERE usr_id = %s FOR UPDATE",
                (user_id,),
            )
            user_row = cur.fetchone()
            if not user_row:
                raise NotFound("User not found.")

            user_name, raw_access = user_row
            access_ids = _parse_access_ids(raw_access)
            had_access = service_id in access_ids
            if grant and not had_access:
                access_ids.append(service_id)
            elif not grant and had_access:
                access_ids = [item for item in access_ids if item != service_id]

            cur.execute(
                "UPDATE usr_info SET usr_access = %s WHERE usr_id = %s",
                (",".join(str(item) for item in access_ids), user_id),
            )
            if not grant:
                cur.execute(
                    "DELETE FROM usr_favorite_services WHERE usr_id = %s AND srv_id = %s",
                    (user_id, service_id),
                )
            conn.commit()
            return Response(
                {
                    "message": "Page access granted." if grant else "Page access revoked.",
                    "changed": not had_access if grant else had_access,
                    "user": {"id": user_id, "name": user_name},
                    "service_id": service_id,
                    "has_access": grant,
                }
            )
        except Exception:
            conn.rollback()
            raise
        finally:
            cur.close()
            conn.close()

    def put(self, request, user_id: int, service_id: int):
        return self._change_access(user_id, service_id, grant=True)

    def delete(self, request, user_id: int, service_id: int):
        return self._change_access(user_id, service_id, grant=False)


class FormManagerNginxPublishView(FormManagerIntegrationView):
    def post(self, request):
        result, response_status = publish_current_nginx_config()
        return Response(
            {"success": response_status < 400, **result},
            status=response_status,
        )
